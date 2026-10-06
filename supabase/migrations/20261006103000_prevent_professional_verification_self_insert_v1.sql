drop policy if exists "professional_profiles_insert_self" on public.professional_profiles;
revoke insert on table public.professional_profiles from authenticated;
