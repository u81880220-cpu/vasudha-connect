revoke execute on function public.rehire_professional(uuid) from public, anon;
grant execute on function public.rehire_professional(uuid) to authenticated;
revoke execute on function public.nearby_professionals_map(numeric,numeric,numeric,uuid,uuid) from public, anon;
grant execute on function public.nearby_professionals_map(numeric,numeric,numeric,uuid,uuid) to authenticated;