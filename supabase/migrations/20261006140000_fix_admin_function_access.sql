-- Admin login calls is_admin() from an authenticated client.
-- Keep the function itself SECURITY DEFINER; only expose execution to signed-in users.
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.is_admin() from anon;
