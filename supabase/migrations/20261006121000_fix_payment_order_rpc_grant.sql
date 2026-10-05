-- The authenticated customer-facing Edge Function creates payment orders
-- through this RPC, so authenticated must be able to execute it.
grant execute on function public.create_connection_payment_order(connection_package_code) to authenticated;
