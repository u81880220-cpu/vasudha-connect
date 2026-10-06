create or replace function public.get_job_contact_and_location(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare j public.jobs; r public.service_requests; customer_phone text; professional_phone text;
begin
 select * into j from public.jobs where id=p_job_id and (customer_id=auth.uid() or professional_id=auth.uid());
 if j.id is null then raise exception 'Job not found or access denied'; end if;
 if j.status not in ('worker_accepted','on_the_way','arrived','work_started','work_completed','customer_confirmed') then raise exception 'Contact and service location are not shared yet'; end if;
 select * into r from public.service_requests where id=j.request_id;
 select phone into customer_phone from public.user_contact_details where user_id=j.customer_id;
 select phone into professional_phone from public.user_contact_details where user_id=j.professional_id;
 return jsonb_build_object('job_id',j.id,'customer',jsonb_build_object('id',j.customer_id,'phone',case when auth.uid()=j.customer_id or j.status in ('worker_accepted','on_the_way','arrived','work_started','work_completed','customer_confirmed') then customer_phone else null end),'professional',jsonb_build_object('id',j.professional_id,'phone',case when auth.uid()=j.professional_id or j.status in ('worker_accepted','on_the_way','arrived','work_started','work_completed','customer_confirmed') then professional_phone else null end),'service_location',jsonb_build_object('address',r.location_text,'latitude',r.location_latitude,'longitude',r.location_longitude),'shared_at',j.updated_at);
end;
$function$;