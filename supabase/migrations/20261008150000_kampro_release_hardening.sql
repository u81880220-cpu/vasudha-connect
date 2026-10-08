-- KAMPRO release hardening: contact 2, live admin rates, duplicate complaint notifications
-- 2026-10-08

create or replace function public.get_job_contact_details(p_job_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
select case
 when j.id is null then '{}'::jsonb
 when auth.uid()=j.professional_id and j.status in ('worker_accepted','on_the_way','arrived','work_started','work_completed','customer_confirmed') then
   jsonb_build_object(
     'customer_phone',(select phone from user_contact_details where user_id=j.customer_id),
     'customer_phone_2',(select phone_2 from user_contact_details where user_id=j.customer_id),
     'location_text',r.location_text,
     'latitude',r.location_latitude,
     'longitude',r.location_longitude,
     'customer_name',coalesce(cp.display_name,cp.full_name,'Customer'))
 when auth.uid()=j.customer_id and j.status in ('worker_accepted','on_the_way','arrived','work_started','work_completed','customer_confirmed') then
   jsonb_build_object(
     'professional_phone',(select phone from user_contact_details where user_id=j.professional_id),
     'professional_phone_2',(select phone_2 from user_contact_details where user_id=j.professional_id),
     'location_text',r.location_text,
     'latitude',r.location_latitude,
     'longitude',r.location_longitude,
     'professional_name',coalesce(pp.display_name,pp.full_name,'Professional'))
 when auth.uid()=j.customer_id then
   jsonb_build_object(
     'professional_phone',(select phone from user_contact_details where user_id=j.professional_id),
     'professional_phone_2',(select phone_2 from user_contact_details where user_id=j.professional_id),
     'professional_name',coalesce(pp.display_name,pp.full_name,'Professional'))
 else '{}'::jsonb end
from jobs j
join service_requests r on r.id=j.request_id
left join profiles cp on cp.id=j.customer_id
left join profiles pp on pp.id=j.professional_id
where j.id=p_job_id;
$function$;

-- Keep one complaint-status notification trigger. The event trigger already
-- creates the reporter/affected-user notification with complaint_id + job_id.
drop trigger if exists trg_complaint_status_notification on public.complaints;

-- Re-sync persisted professional metrics from authoritative transactional data.
update public.professional_profiles pp
set response_rate = case
      when x.total_requests=0 then 0
      else round((x.responded_requests::numeric / x.total_requests::numeric) * 100, 2)
    end,
    completion_rate = case
      when x.total_jobs=0 then 0
      else round((x.completed_jobs::numeric / x.total_jobs::numeric) * 100, 2)
    end,
    updated_at=now()
from (
  select pp2.user_id,
    (select count(*) from public.service_requests r where r.professional_id=pp2.user_id) total_requests,
    (select count(*) from public.service_requests r where r.professional_id=pp2.user_id and r.status in ('accepted','rejected')) responded_requests,
    (select count(*) from public.jobs j where j.professional_id=pp2.user_id) total_jobs,
    (select count(*) from public.jobs j where j.professional_id=pp2.user_id and j.status='customer_confirmed') completed_jobs
  from public.professional_profiles pp2
) x
where pp.user_id=x.user_id;
