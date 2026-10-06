create table if not exists public.job_live_locations (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  latitude numeric not null check(latitude between -90 and 90),
  longitude numeric not null check(longitude between -180 and 180),
  accuracy_m numeric,
  updated_at timestamptz not null default now()
);
alter table public.job_live_locations enable row level security;

drop policy if exists "job participants read live location" on public.job_live_locations;
create policy "job participants read live location" on public.job_live_locations
for select to authenticated using (
 exists(select 1 from public.jobs j where j.id=job_live_locations.job_id and (j.customer_id=auth.uid() or j.professional_id=auth.uid()) and j.status in ('worker_accepted','on_the_way','arrived','work_started'))
);

drop policy if exists "professional writes own live location" on public.job_live_locations;
create policy "professional writes own live location" on public.job_live_locations
for all to authenticated using (
 exists(select 1 from public.jobs j where j.id=job_live_locations.job_id and j.professional_id=auth.uid() and j.status in ('worker_accepted','on_the_way','arrived','work_started'))
) with check (
 professional_id=auth.uid()
 and exists(select 1 from public.jobs j where j.id=job_live_locations.job_id and j.professional_id=auth.uid() and j.status in ('worker_accepted','on_the_way','arrived','work_started'))
);

create or replace function public.update_professional_live_location(p_job_id uuid,p_latitude numeric,p_longitude numeric,p_accuracy_m numeric default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if p_latitude is null or p_latitude not between -90 and 90 or p_longitude is null or p_longitude not between -180 and 180 then raise exception 'Invalid location'; end if;
 if not exists(select 1 from public.jobs where id=p_job_id and professional_id=auth.uid() and status in ('worker_accepted','on_the_way','arrived','work_started')) then raise exception 'Live location is available only for an active assigned job'; end if;
 insert into public.job_live_locations(job_id,professional_id,latitude,longitude,accuracy_m,updated_at)
 values(p_job_id,auth.uid(),p_latitude,p_longitude,p_accuracy_m,now())
 on conflict(job_id) do update set professional_id=excluded.professional_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=now();
end;
$$;
revoke all on function public.update_professional_live_location(uuid,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.update_professional_live_location(uuid,numeric,numeric,numeric) to authenticated;

create or replace function public.get_job_live_location(p_job_id uuid)
returns table(job_id uuid,professional_id uuid,latitude numeric,longitude numeric,accuracy_m numeric,updated_at timestamptz)
language sql security definer set search_path=public as $$
 select l.job_id,l.professional_id,l.latitude,l.longitude,l.accuracy_m,l.updated_at
 from public.job_live_locations l join public.jobs j on j.id=l.job_id
 where l.job_id=p_job_id and (j.customer_id=auth.uid() or j.professional_id=auth.uid())
 and j.status in ('worker_accepted','on_the_way','arrived','work_started')
$$;
revoke all on function public.get_job_live_location(uuid) from public,anon,authenticated;
grant execute on function public.get_job_live_location(uuid) to authenticated;

create or replace function public.get_job_contact_and_location(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.jobs; r public.service_requests; customer_phone text; professional_phone text;
begin
 select * into j from public.jobs where id=p_job_id and (customer_id=auth.uid() or professional_id=auth.uid());
 if j.id is null then raise exception 'Job not found or access denied'; end if;
 if j.status not in ('worker_accepted','on_the_way','arrived','work_started','work_completed','customer_confirmed') then raise exception 'Contact and service location are not shared yet'; end if;
 select * into r from public.service_requests where id=j.request_id;
 select phone into customer_phone from public.user_contact_details where user_id=j.customer_id;
 select phone into professional_phone from public.user_contact_details where user_id=j.professional_id;
 return jsonb_build_object('job_id',j.id,'customer',jsonb_build_object('id',j.customer_id,'phone',customer_phone),'professional',jsonb_build_object('id',j.professional_id,'phone',professional_phone),'service_location',jsonb_build_object('address',r.location_text,'latitude',r.location_latitude,'longitude',r.location_longitude),'shared_at',j.updated_at);
end;
$$;
revoke all on function public.get_job_contact_and_location(uuid) from public,anon,authenticated;
grant execute on function public.get_job_contact_and_location(uuid) to authenticated;
