revoke all on function public.set_verification_pending_on_submission() from public;
revoke execute on function public.set_verification_pending_on_submission() from authenticated;

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
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_professional_id is null or p_service_id is null then raise exception 'Professional and service are required'; end if;
  if nullif(trim(coalesce(p_title,'')), '') is null then raise exception 'Job title is required'; end if;
  if nullif(trim(coalesce(p_description,'')), '') is null then raise exception 'Work description is required'; end if;
  if nullif(trim(coalesce(p_location_text,'')), '') is null then raise exception 'Service location is required'; end if;
  if p_location_latitude is not null and (p_location_latitude < -90 or p_location_latitude > 90) then raise exception 'Invalid latitude'; end if;
  if p_location_longitude is not null and (p_location_longitude < -180 or p_location_longitude > 180) then raise exception 'Invalid longitude'; end if;

  if not exists (
    select 1 from public.professional_profiles pp
    where pp.user_id=p_professional_id
      and pp.verification_status='verified'::verification_status
      and pp.is_available=true
  ) then raise exception 'Professional is not currently available'; end if;

  if not exists (
    select 1 from public.professional_connections pc
    where pc.customer_id=auth.uid()
      and pc.professional_id=p_professional_id
      and (pc.expires_at is null or pc.expires_at>now())
  ) then raise exception 'Unlock this professional before sending a job request'; end if;

  if not exists (
    select 1 from public.service_catalogue_services s
    where s.id=p_service_id and s.status='active'
  ) then raise exception 'Selected service is not active'; end if;

  if p_sub_service_id is not null and not exists (
    select 1 from public.service_catalogue_sub_services ss
    where ss.id=p_sub_service_id
      and ss.service_id=p_service_id
      and ss.status='active'
  ) then raise exception 'Selected sub-service is not valid'; end if;

  if p_sub_service_id is not null and not exists (
    select 1 from public.professional_sub_services ps
    where ps.professional_id=p_professional_id
      and ps.sub_service_id=p_sub_service_id
  ) then raise exception 'Professional does not offer the selected sub-service'; end if;

  insert into public.service_requests (
    customer_id,professional_id,service_id,sub_service_id,title,description,
    preferred_date,preferred_time,location_text,location_latitude,location_longitude
  )
  values (
    auth.uid(),p_professional_id,p_service_id,p_sub_service_id,trim(p_title),
    trim(p_description),p_preferred_date,nullif(trim(coalesce(p_preferred_time,'')), ''),
    trim(p_location_text),p_location_latitude,p_location_longitude
  )
  returning id into v_request_id;

  return v_request_id;
end;
$function$;