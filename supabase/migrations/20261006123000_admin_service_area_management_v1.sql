create or replace function public.admin_save_professional_service_area(
  p_action text,
  p_user_id uuid,
  p_area_id uuid default null,
  p_label text default null,
  p_city text default null,
  p_state text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_radius_km numeric default 10,
  p_is_primary boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('create','update','delete') then raise exception 'Invalid area action'; end if;
  if p_action in ('create','update') then
    if p_user_id is null or coalesce(trim(p_label),'')='' then raise exception 'Professional and area label are required'; end if;
    if p_radius_km is null or p_radius_km<=0 or p_radius_km>500 then raise exception 'Radius must be between 0 and 500 km'; end if;
    if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then raise exception 'Invalid latitude'; end if;
    if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then raise exception 'Invalid longitude'; end if;
  end if;
  if p_action='delete' then
    delete from public.service_areas where id=p_area_id and professional_id=p_user_id;
    if not found then raise exception 'Service area not found'; end if;
    return p_area_id;
  end if;
  if p_is_primary then
    update public.service_areas set is_primary=false
    where professional_id=p_user_id and (p_area_id is null or id<>p_area_id);
  end if;
  if p_action='create' then
    insert into public.service_areas(professional_id,label,city,state,latitude,longitude,radius_km,is_primary)
    values(p_user_id,trim(p_label),nullif(trim(p_city),''),nullif(trim(p_state),''),p_latitude,p_longitude,p_radius_km,p_is_primary)
    returning id into v_id;
  else
    update public.service_areas
    set label=trim(p_label),city=nullif(trim(p_city),''),state=nullif(trim(p_state),''),
        latitude=p_latitude,longitude=p_longitude,radius_km=p_radius_km,is_primary=p_is_primary
    where id=p_area_id and professional_id=p_user_id
    returning id into v_id;
    if v_id is null then raise exception 'Service area not found'; end if;
  end if;
  return v_id;
end;
$function$;
revoke all on function public.admin_save_professional_service_area(text,uuid,uuid,text,text,text,numeric,numeric,numeric,boolean) from public, anon, authenticated;
grant execute on function public.admin_save_professional_service_area(text,uuid,uuid,text,text,text,numeric,numeric,numeric,boolean) to authenticated;
