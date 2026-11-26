-- Keep one unambiguous PostgREST RPC signature for professional live-location updates.
-- Registered service-area/base coordinates are intentionally left unchanged.
drop function if exists public.update_professional_marketplace_location(double precision,double precision);

create or replace function public.update_professional_marketplace_location(
  p_latitude numeric,
  p_longitude numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid GPS coordinates';
  end if;
  update public.professional_profiles
     set marketplace_latitude = p_latitude,
         marketplace_longitude = p_longitude,
         marketplace_location_updated_at = now(),
         updated_at = now()
   where user_id = v_user_id
     and is_available = true;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.update_professional_marketplace_location(numeric,numeric) from public;
revoke all on function public.update_professional_marketplace_location(numeric,numeric) from anon;
grant execute on function public.update_professional_marketplace_location(numeric,numeric) to authenticated;
