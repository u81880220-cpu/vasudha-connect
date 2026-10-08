create or replace function public.accept_service_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $function$
declare
  r public.service_requests;
  v_job uuid;
  v_available boolean;
begin
  select * into r
  from public.service_requests
  where id=p_request_id
    and professional_id=auth.uid()
    and status='requested'::quote_status
  for update;

  if r.id is null then raise exception 'Service request not found or already accepted'; end if;

  select is_available into v_available from public.professional_profiles where user_id=auth.uid();
  if coalesce(v_available,false)=false then raise exception 'Set yourself as available before accepting a job'; end if;

  if exists(select 1 from public.jobs where professional_id=auth.uid() and status in ('worker_accepted','on_the_way','arrived','work_started')) then
    raise exception 'Finish the current active job before accepting another job';
  end if;

  if not exists (
    select 1 from public.professional_connections c
    where c.customer_id=r.customer_id and c.professional_id=auth.uid() and c.expires_at>now()
  ) then raise exception 'Active customer connection is required'; end if;

  update public.service_requests set status='accepted'::quote_status,updated_at=now() where id=r.id;

  insert into public.jobs(request_id,quote_id,customer_id,professional_id,title,agreed_amount_inr,status)
  values(r.id,null,r.customer_id,r.professional_id,coalesce(nullif(trim(r.title),''),'Job request'),null,'worker_accepted'::job_status)
  on conflict(request_id) do update set status='worker_accepted'::job_status,updated_at=now()
  returning id into v_job;

  update public.professional_profiles set is_available=false,updated_at=now() where user_id=auth.uid();
  return v_job;
end;
$function$;
