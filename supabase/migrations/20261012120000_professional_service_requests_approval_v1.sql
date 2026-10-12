create table if not exists public.professional_service_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  category_name text not null,
  service_name text not null,
  sub_service_name text,
  description text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists professional_service_requests_status_created_idx on public.professional_service_requests(status, created_at desc);
alter table public.professional_service_requests enable row level security;
drop policy if exists "Professionals submit own service requests" on public.professional_service_requests;
create policy "Professionals submit own service requests" on public.professional_service_requests for insert to authenticated with check (professional_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);
drop policy if exists "Professionals read own service requests" on public.professional_service_requests;
create policy "Professionals read own service requests" on public.professional_service_requests for select to authenticated using (professional_id = auth.uid() or exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
drop policy if exists "Admins update service requests" on public.professional_service_requests;
create policy "Admins update service requests" on public.professional_service_requests for update to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
grant select, insert, update on public.professional_service_requests to authenticated;

create or replace function public.admin_review_professional_service_request(p_request_id uuid, p_decision text, p_admin_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.professional_service_requests%rowtype; cat_id uuid; svc_id uuid; cat_slug text; svc_slug text; sub_slug text;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Admin access required'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
 select * into r from public.professional_service_requests where id=p_request_id for update;
 if not found then raise exception 'Service request not found'; end if;
 if r.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;
 if p_decision='approved' then
  cat_slug:=trim(both '-' from regexp_replace(lower(r.category_name),'[^a-z0-9]+','-','g'));
  if cat_slug='' then raise exception 'Invalid category name'; end if;
  select id into cat_id from public.service_categories where lower(name)=lower(r.category_name) limit 1;
  if cat_id is null then
   insert into public.service_categories(name,slug,status,description) values(r.category_name,cat_slug,'active','Added following a professional service request')
   on conflict (slug) do update set status='active',updated_at=now() returning id into cat_id;
  end if;
  svc_slug:=trim(both '-' from regexp_replace(lower(r.service_name),'[^a-z0-9]+','-','g'));
  select id into svc_id from public.service_catalogue_services where category_id=cat_id and lower(name)=lower(r.service_name) limit 1;
  if svc_id is null then
   insert into public.service_catalogue_services(category_id,name,slug,status,description) values(cat_id,r.service_name,cat_slug||'-'||svc_slug,'active',nullif(r.description,''))
   on conflict (slug) do update set status='active',updated_at=now() returning id into svc_id;
  end if;
  if nullif(trim(r.sub_service_name),'') is not null then
   sub_slug:=cat_slug||'-'||svc_slug||'-'||trim(both '-' from regexp_replace(lower(r.sub_service_name),'[^a-z0-9]+','-','g'));
   insert into public.service_catalogue_sub_services(service_id,name,slug,status,description) values(svc_id,r.sub_service_name,sub_slug,'active',nullif(r.description,''))
   on conflict (slug) do update set service_id=excluded.service_id,name=excluded.name,status='active',updated_at=now();
  end if;
 end if;
 update public.professional_service_requests set status=p_decision,admin_note=nullif(trim(p_admin_note),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_request_id;
 return jsonb_build_object('success',true,'status',p_decision);
end; $$;
revoke all on function public.admin_review_professional_service_request(uuid,text,text) from public, anon;
grant execute on function public.admin_review_professional_service_request(uuid,text,text) to authenticated;
