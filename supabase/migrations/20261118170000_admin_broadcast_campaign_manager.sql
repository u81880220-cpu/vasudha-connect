create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.admin_broadcast_campaigns (
 id uuid primary key default gen_random_uuid(), title text not null, message text not null,
 audience text not null check (audience in ('customers','professionals','both','selected')),
 target_city text, selected_user_ids uuid[],
 delivery_channel text not null check (delivery_channel in ('push','in_app','both')),
 scheduled_at timestamptz, status text not null default 'scheduled' check (status in ('scheduled','processing','sent','failed','cancelled')),
 recipient_count integer not null default 0, push_requested boolean not null default false,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 sent_at timestamptz, last_error text
);
create index if not exists admin_broadcast_due_idx on public.admin_broadcast_campaigns(status,scheduled_at);
create index if not exists admin_broadcast_created_idx on public.admin_broadcast_campaigns(created_at desc);
create table if not exists public.admin_broadcast_recipients (
 campaign_id uuid not null references public.admin_broadcast_campaigns(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 notification_id uuid references public.notifications(id) on delete set null,
 created_at timestamptz not null default now(), primary key(campaign_id,user_id)
);
alter table public.admin_broadcast_campaigns enable row level security;
alter table public.admin_broadcast_recipients enable row level security;
revoke all on public.admin_broadcast_campaigns, public.admin_broadcast_recipients from anon, authenticated;
grant select on public.admin_broadcast_campaigns to authenticated;

create or replace function public._deliver_admin_broadcast(p_campaign_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare c public.admin_broadcast_campaigns%rowtype; v_count integer:=0;
begin
 select * into c from public.admin_broadcast_campaigns where id=p_campaign_id for update;
 if not found or c.status not in ('scheduled','processing') then return 0; end if;
 update public.admin_broadcast_campaigns set status='processing',last_error=null where id=c.id;
 with targets as (
  select p.id from public.profiles p where p.account_status::text='active'
   and (c.audience='both' or (c.audience='customers' and p.current_mode::text='customer')
    or (c.audience='professionals' and p.current_mode::text='professional')
    or (c.audience='selected' and p.id=any(coalesce(c.selected_user_ids,'{}'::uuid[]))))
   and (c.target_city is null or lower(coalesce(p.city,''))=lower(c.target_city))
 ), inserted as (
  insert into public.admin_broadcast_recipients(campaign_id,user_id) select c.id,t.id from targets t on conflict do nothing returning user_id
 ), notifications_created as (
  insert into public.notifications(user_id,type,title,message,data)
  select i.user_id,'system'::public.notification_type,c.title,c.message,
   jsonb_build_object('campaign_id',c.id,'delivery_channel',c.delivery_channel,'screen','notifications','category','promotion')
  from inserted i returning id,user_id
 )
 update public.admin_broadcast_recipients r set notification_id=n.id from notifications_created n
 where r.campaign_id=c.id and r.user_id=n.user_id;
 select count(*) into v_count from public.admin_broadcast_recipients where campaign_id=c.id;
 update public.admin_broadcast_campaigns set status='sent',recipient_count=v_count,sent_at=now(),push_requested=(c.delivery_channel in ('push','both')) where id=c.id;
 return v_count;
exception when others then update public.admin_broadcast_campaigns set status='failed',last_error=sqlerrm where id=p_campaign_id; raise;
end; $$;

create or replace function public.admin_create_broadcast_campaign(
 p_title text,p_message text,p_audience text,p_delivery_channel text,p_target_city text default null,
 p_selected_user_ids uuid[] default null,p_scheduled_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 100 then raise exception 'Title must be 1-100 characters'; end if;
 if length(trim(coalesce(p_message,''))) not between 1 and 1000 then raise exception 'Message must be 1-1000 characters'; end if;
 if p_audience not in ('customers','professionals','both','selected') then raise exception 'Invalid audience'; end if;
 if p_delivery_channel not in ('push','in_app','both') then raise exception 'Invalid delivery channel'; end if;
 if p_audience='selected' and coalesce(array_length(p_selected_user_ids,1),0)=0 then raise exception 'Select at least one user'; end if;
 if p_scheduled_at is not null and p_scheduled_at<now()-interval '1 minute' then raise exception 'Scheduled time must be in the future'; end if;
 insert into public.admin_broadcast_campaigns(title,message,audience,target_city,selected_user_ids,delivery_channel,scheduled_at,status,created_by)
 values(trim(p_title),trim(p_message),p_audience,nullif(trim(coalesce(p_target_city,'')),''),p_selected_user_ids,p_delivery_channel,coalesce(p_scheduled_at,now()),'scheduled',auth.uid()) returning id into v_id;
 if p_scheduled_at is null or p_scheduled_at<=now() then perform public._deliver_admin_broadcast(v_id); end if;
 perform public.admin_record_audit('create_broadcast_campaign','broadcast_campaign',v_id,jsonb_build_object('audience',p_audience,'channel',p_delivery_channel));
 return v_id;
end; $$;

create or replace function public.process_due_admin_broadcasts()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
 for r in select id from public.admin_broadcast_campaigns where status='scheduled' and scheduled_at<=now() order by scheduled_at for update skip locked limit 25 loop
  perform public._deliver_admin_broadcast(r.id); n:=n+1;
 end loop; return n;
end; $$;

create or replace function public.admin_broadcast_campaigns()
returns table(id uuid,title text,message text,audience text,target_city text,delivery_channel text,scheduled_at timestamptz,status text,recipient_count integer,created_at timestamptz,sent_at timestamptz,last_error text)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 return query select c.id,c.title,c.message,c.audience,c.target_city,c.delivery_channel,c.scheduled_at,c.status,c.recipient_count,c.created_at,c.sent_at,c.last_error
 from public.admin_broadcast_campaigns c order by c.created_at desc limit 100;
end; $$;

create or replace function public.enqueue_push_for_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_secret text; v_url text;
begin
 if coalesce(new.data->>'delivery_channel','both')='in_app' then return new; end if;
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='vasudha_push_internal_secret' limit 1;
 v_url:='https://bbweclhmbzwmflijppoi.supabase.co/functions/v1/send-push-notification';
 if v_secret is not null then perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-vasudha-internal-secret',v_secret),body:=jsonb_build_object('notification_id',new.id)); end if;
 return new;
end; $$;

revoke all on function public._deliver_admin_broadcast(uuid) from public,anon,authenticated;
revoke all on function public.process_due_admin_broadcasts() from public,anon,authenticated;
revoke all on function public.admin_create_broadcast_campaign(text,text,text,text,text,uuid[],timestamptz) from public,anon;
grant execute on function public.admin_create_broadcast_campaign(text,text,text,text,text,uuid[],timestamptz) to authenticated;
grant execute on function public.admin_broadcast_campaigns() to authenticated;
revoke all on function public.admin_broadcast_campaigns() from public,anon;
select cron.schedule('kampro-admin-broadcast-dispatch','* * * * *','select public.process_due_admin_broadcasts();');
