create or replace function public.update_professional_profile(
  p_headline text default null,
  p_about text default null,
  p_years_experience integer default 0,
  p_service_radius_km numeric default 10,
  p_is_available boolean default false,
  p_base_latitude numeric default null,
  p_base_longitude numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_years_experience < 0 or p_years_experience > 100 then raise exception 'Invalid experience'; end if;
  if p_service_radius_km <= 0 or p_service_radius_km > 500 then raise exception 'Service radius must be between 0 and 500 km'; end if;
  if p_base_latitude is not null and (p_base_latitude < -90 or p_base_latitude > 90) then raise exception 'Invalid latitude'; end if;
  if p_base_longitude is not null and (p_base_longitude < -180 or p_base_longitude > 180) then raise exception 'Invalid longitude'; end if;
  update public.professional_profiles
  set headline=nullif(trim(p_headline),''),
      about=nullif(trim(p_about),''),
      years_experience=p_years_experience,
      service_radius_km=p_service_radius_km,
      is_available=(p_is_available and verification_status='verified'::verification_status),
      base_latitude=p_base_latitude,
      base_longitude=p_base_longitude
  where user_id=auth.uid();
  if not found then raise exception 'Professional profile not found'; end if;
end;
$function$;