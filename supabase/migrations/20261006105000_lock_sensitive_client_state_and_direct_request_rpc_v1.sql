-- VASUDHA Connect: lock sensitive state tables to server-side RPCs.
-- Client users may read their permitted rows, but cannot mutate balances,
-- subscriptions, jobs, connection records, live locations, or verification state.

revoke insert, update, delete on public.professional_profiles from authenticated;
grant select on public.professional_profiles to authenticated;

revoke insert, update, delete on public.connection_wallets from authenticated;
grant select on public.connection_wallets to authenticated;

revoke insert, update, delete on public.connection_purchases from authenticated;
grant select on public.connection_purchases to authenticated;

revoke insert, update, delete on public.connection_payment_orders from authenticated;
grant select on public.connection_payment_orders to authenticated;

revoke insert, update, delete on public.professional_connections from authenticated;
grant select on public.professional_connections to authenticated;

revoke insert, update, delete on public.professional_subscriptions from authenticated;
grant select on public.professional_subscriptions to authenticated;

revoke insert, update, delete on public.professional_subscription_payment_orders from authenticated;
grant select on public.professional_subscription_payment_orders to authenticated;

revoke insert, update, delete on public.jobs from authenticated;
grant select on public.jobs to authenticated;

revoke insert, update, delete on public.job_live_locations from authenticated;
grant select on public.job_live_locations to authenticated;

revoke update, delete on public.verification_documents from authenticated;
revoke insert on public.verification_documents from authenticated;
grant insert (professional_id, document_type, document_url) on public.verification_documents to authenticated;

revoke insert, update, delete on public.service_requests from authenticated;

create or replace function public.create_service_request(
  p_professional_id uuid,
  p_service_id uuid,
  p_sub_service_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_preferred_date date default null,
  p_preferred_time text default null,
  p_location_text text default null,
  p_location_latitude numeric default null,
  p_location_longitude numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_professional_id is null or p_service_id is null then
    raise exception 'Professional and service are required';
  end if;

  if nullif(trim(coalesce(p_title,'')), '') is null then
    raise exception 'Job title is required';
  end if;

  if nullif(trim(coalesce(p_description,'')), '') is null then
    raise exception 'Work description is required';
  end if;

  if nullif(trim(coalesce(p_location_text,'')), '') is null then
    raise exception 'Service location is required';
  end if;

  if p_location_latitude is not null and (p_location_latitude < -90 or p_location_latitude > 90) then
    raise exception 'Invalid latitude';
  end if;

  if p_location_longitude is not null and (p_location_longitude < -180 or p_location_longitude > 180) then
    raise exception 'Invalid longitude';
  end if;

  if not exists (
    select 1
    from public.professional_profiles pp
    where pp.user_id = p_professional_id
      and pp.verification_status = 'verified'::verification_status
      and pp.is_available = true
  ) then
    raise exception 'Professional is not currently available';
  end if;

  if not exists (
    select 1
    from public.professional_connections pc
    where pc.customer_id = auth.uid()
      and pc.professional_id = p_professional_id
      and (pc.expires_at is null or pc.expires_at > now())
  ) then
    raise exception 'Unlock this professional before sending a job request';
  end if;

  insert into public.service_requests (
    customer_id,
    professional_id,
    service_id,
    sub_service_id,
    title,
    description,
    preferred_date,
    preferred_time,
    location_text,
    location_latitude,
    location_longitude
  )
  values (
    auth.uid(),
    p_professional_id,
    p_service_id,
    p_sub_service_id,
    trim(p_title),
    trim(p_description),
    p_preferred_date,
    nullif(trim(coalesce(p_preferred_time,'')), ''),
    trim(p_location_text),
    p_location_latitude,
    p_location_longitude
  )
  returning id into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function public.create_service_request(uuid,uuid,uuid,text,text,date,text,text,numeric,numeric) from public;
grant execute on function public.create_service_request(uuid,uuid,uuid,text,text,date,text,text,numeric,numeric) to authenticated;

create or replace function public.set_verification_pending_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.professional_profiles
  set verification_status = 'pending'::verification_status,
      updated_at = now()
  where user_id = new.professional_id
    and verification_status <> 'verified'::verification_status;
  return new;
end;
$function$;

drop trigger if exists trg_verification_submission_pending on public.verification_documents;
create trigger trg_verification_submission_pending
after insert on public.verification_documents
for each row execute function public.set_verification_pending_on_submission();

alter table public.jobs
  alter column status set default 'worker_accepted'::job_status;
