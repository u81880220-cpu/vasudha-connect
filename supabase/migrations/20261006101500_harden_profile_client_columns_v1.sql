revoke insert on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant update (full_name, display_name, avatar_url, bio, city, state, country) on table public.profiles to authenticated;
