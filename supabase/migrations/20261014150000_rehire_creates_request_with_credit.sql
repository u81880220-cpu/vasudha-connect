-- Rehire is a new service request and must atomically consume one connection credit.
-- The job-row lock plus pending-request check makes repeated taps idempotent.
create or replace function public.rehire_professional(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_request public.service_requests%rowtype;
  v_request_id uuid;
  v_service_id uuid;
  v_sub_service_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_job
  from public.jobs
  where id = p_job_id and customer_id = auth.uid()
  for update;

  if not found then
    raise exception 'Job not found or access denied';
  end if;

  if v_job.status not in ('work_completed', 'customer_confirmed') then
    raise exception 'Rehire is available after work is completed';
  end if;

  if v_job.professional_id is null then
    raise exception 'This job has no linked professional';
  end if;

  select sr.id into v_request_id
  from public.service_requests sr
  where sr.customer_id = auth.uid()
    and sr.professional_id = v_job.professional_id
    and sr.status in ('requested', 'submitted')
  order by sr.created_at desc
  limit 1;

  if v_request_id is not null then
    return v_request_id;
  end if;

  if v_job.request_id is not null then
    select * into v_request
    from public.service_requests
    where id = v_job.request_id;
  end if;

  v_service_id := v_request.service_id;
  v_sub_service_id := v_request.sub_service_id;

  if v_service_id is null then
    select ss.service_id, ss.id
      into v_service_id, v_sub_service_id
    from public.professional_sub_services ps
    join public.service_catalogue_sub_services ss on ss.id = ps.sub_service_id
    where ps.professional_id = v_job.professional_id
      and ss.status = 'active'
    order by ps.is_primary desc
    limit 1;
  end if;

  if v_service_id is null then
    raise exception 'The original service is unavailable. Choose a service from this professional profile instead.';
  end if;

  if not exists (
    select 1 from public.professional_profiles pp
    where pp.user_id = v_job.professional_id
      and pp.verification_status = 'verified'::verification_status
      and pp.is_available = true
  ) then
    raise exception 'Professional is not currently available';
  end if;

  update public.connection_wallets
  set balance = balance - 1,
      updated_at = now()
  where user_id = auth.uid()
    and balance > 0;

  if not found then
    raise exception 'No connection credits available';
  end if;

  update public.professional_connections
  set expires_at = now() + interval '30 days',
      last_accessed_at = now(),
      purchased_at = now()
  where customer_id = auth.uid()
    and professional_id = v_job.professional_id;

  if not found then
    insert into public.professional_connections(
      customer_id, professional_id, expires_at, last_accessed_at, purchased_at
    )
    values (
      auth.uid(), v_job.professional_id, now() + interval '30 days', now(), now()
    )
    on conflict(customer_id, professional_id) do update
      set expires_at = excluded.expires_at,
          last_accessed_at = now(),
          purchased_at = now();
  end if;

  insert into public.service_requests(
    customer_id, professional_id, title, description,
    preferred_date, preferred_time, location_text,
    location_latitude, location_longitude, service_id, sub_service_id, status
  )
  values(
    auth.uid(),
    v_job.professional_id,
    coalesce(v_request.title, v_job.title, 'Repeat service'),
    coalesce(v_request.description, 'Repeat the previous service with this professional.'),
    null, null, v_request.location_text,
    v_request.location_latitude, v_request.location_longitude,
    v_service_id, v_sub_service_id, 'requested'
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.rehire_professional(uuid) from public, anon;
grant execute on function public.rehire_professional(uuid) to authenticated;
