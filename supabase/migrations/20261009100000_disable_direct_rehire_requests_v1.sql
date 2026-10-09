-- Rehire must follow the same connect-first flow as every other professional.
-- The mobile app now routes Rehire Professional to the public professional profile,
-- where the customer must unlock a connection before creating a service request.
-- Disable the legacy RPC so an older client cannot bypass the unlock step.
revoke all on function public.rehire_professional(uuid) from public;
revoke execute on function public.rehire_professional(uuid) from authenticated;
