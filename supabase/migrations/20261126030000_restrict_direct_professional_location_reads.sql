-- Keep exact professional coordinates readable only by the professional who owns the row.
-- Customer-facing discovery uses nearby_professionals_map, which returns rounded coordinates.
alter policy professional_profiles_select
on public.professional_profiles
using (auth.uid() = user_id);

alter policy service_areas_select
on public.service_areas
using (auth.uid() = professional_id);
