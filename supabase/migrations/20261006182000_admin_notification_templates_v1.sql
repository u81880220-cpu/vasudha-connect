create table if not exists public.notification_templates (
 id uuid primary key default gen_random_uuid(),
 key text not null unique,
 title text not null,
 message text not null,
 channel text not null default 'push' check(channel in ('push','in_app')),
 enabled boolean not null default true,
 description text,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.notification_templates enable row level security;

create or replace function public.admin_notification_templates()
returns table(id uuid,key text,title text,message text,channel text,enabled boolean,description text,updated_at timestamptz)
language sql security definer set search_path=public as $$
 select id,key,title,message,channel,enabled,description,updated_at from public.notification_templates
 where public.is_admin() order by key
$$;
revoke all on function public.admin_notification_templates() from public,anon,authenticated;
grant execute on function public.admin_notification_templates() to authenticated;

create or replace function public.admin_save_notification_template(
 p_action text,p_id uuid default null,p_key text default null,p_title text default null,p_message text default null,
 p_channel text default 'push',p_enabled boolean default true,p_description text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_action not in ('create','update','delete') then raise exception 'Invalid template action'; end if;
 if p_action='delete' then delete from public.notification_templates where id=p_id returning id into v_id; if v_id is null then raise exception 'Template not found'; end if; return v_id; end if;
 if coalesce(trim(p_key),'')='' or coalesce(trim(p_title),'')='' or coalesce(trim(p_message),'')='' then raise exception 'Key, title and message are required'; end if;
 if p_channel not in ('push','in_app') then raise exception 'Invalid notification channel'; end if;
 if p_action='create' then
   insert into public.notification_templates(key,title,message,channel,enabled,description,updated_by) values(trim(p_key),trim(p_title),trim(p_message),p_channel,p_enabled,nullif(trim(p_description),''),auth.uid()) returning id into v_id;
 else
   update public.notification_templates set key=trim(p_key),title=trim(p_title),message=trim(p_message),channel=p_channel,enabled=p_enabled,description=nullif(trim(p_description),''),updated_at=now(),updated_by=auth.uid() where id=p_id returning id into v_id;
   if v_id is null then raise exception 'Template not found'; end if;
 end if;
 return v_id;
end; $$;
revoke all on function public.admin_save_notification_template(text,uuid,text,text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_save_notification_template(text,uuid,text,text,text,text,boolean,text) to authenticated;

insert into public.notification_templates(key,title,message,channel,enabled,description) values
('connection_unlocked','Professional unlocked','You can now view the professional contact details and start a chat.','push',true,'Sent after a customer unlocks a professional.'),
('job_request_received','New job request','A customer has sent you a job request. Review the details and accept if you agree.','push',true,'Sent to professionals when a customer submits a job request.'),
('job_accepted','Job accepted','Your professional has accepted the job. Service location and contact details are now shared.','push',true,'Sent after professional acceptance.'),
('live_location_active','Professional is on the way','Your professional has started travelling to your service location.','push',true,'Sent when live location tracking begins.'),
('job_completed','Work completed','The professional marked the work completed. Please review the service.','push',true,'Sent after completion.'),
('review_reminder','Review reminder','Please share your experience after the service is completed.','push',true,'Review reminder.'),
('subscription_expiring','Subscription expiring','Your professional subscription is nearing its expiry date.','push',true,'Professional subscription reminder.'),
('subscription_payment_failed','Subscription payment failed','Your professional subscription payment could not be completed.','push',true,'Professional subscription payment failure.')
on conflict (key) do nothing;
