-- Private professional requests and GPS mutation must not be callable by anonymous visitors.
revoke all on function public.get_professional_requests_with_service() from public, anon;
grant execute on function public.get_professional_requests_with_service() to authenticated;

revoke all on function public.update_professional_marketplace_location(numeric, numeric) from public, anon;
grant execute on function public.update_professional_marketplace_location(numeric, numeric) to authenticated;
