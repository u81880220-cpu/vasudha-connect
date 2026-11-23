CREATE OR REPLACE FUNCTION public.create_service_request(
  p_professional_id uuid,
  p_service_id uuid,
  p_sub_service_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_preferred_date date DEFAULT NULL,
  p_preferred_time text DEFAULT NULL,
  p_location_text text DEFAULT NULL,
  p_location_latitude numeric DEFAULT NULL,
  p_location_longitude numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_request_id uuid;
  v_title text;
  v_service_name text;
  v_sub_service_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_professional_id is null or p_service_id is null then raise exception 'Professional and service are required'; end if;
  if auth.uid() = p_professional_id then
    raise exception 'You cannot book your own professional service. Please choose another professional.';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_professional_id::text));

  if exists (
    select 1
    from public.service_requests sr
    left join public.jobs j on j.request_id = sr.id
    where sr.customer_id = auth.uid()
      and sr.professional_id = p_professional_id
      and sr.status::text in ('requested','submitted','accepted')
      and (j.id is null or j.status::text not in ('customer_confirmed','cancelled'))
  ) then
    raise exception 'You already have an active job with this professional. Please complete or cancel it before creating another job.';
  end if;

  select s.name into v_service_name
  from public.service_catalogue_services s
  where s.id=p_service_id and s.status='active';
  if v_service_name is null then raise exception 'Selected service is not active'; end if;

  if p_sub_service_id is not null then
    select ss.name into v_sub_service_name
    from public.service_catalogue_sub_services ss
    where ss.id=p_sub_service_id and ss.service_id=p_service_id and ss.status='active';
    if v_sub_service_name is null then raise exception 'Selected sub-service is not valid'; end if;
  end if;

  v_title := nullif(trim(coalesce(p_title,'')), '');
  if v_title is null then v_title := coalesce(v_sub_service_name, v_service_name); end if;

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

  if p_sub_service_id is not null and not exists (
    select 1 from public.professional_sub_services ps
    where ps.professional_id=p_professional_id and ps.sub_service_id=p_sub_service_id
  ) then raise exception 'Professional does not offer the selected sub-service'; end if;

  insert into public.service_requests (
    customer_id,professional_id,service_id,sub_service_id,title,description,
    preferred_date,preferred_time,location_text,location_latitude,location_longitude
  )
  values (
    auth.uid(),p_professional_id,p_service_id,p_sub_service_id,v_title,
    nullif(trim(coalesce(p_description,'')), ''),
    p_preferred_date,nullif(trim(coalesce(p_preferred_time,'')), ''),
    trim(p_location_text),p_location_latitude,p_location_longitude
  )
  returning id into v_request_id;
  return v_request_id;
end;
$function$;
