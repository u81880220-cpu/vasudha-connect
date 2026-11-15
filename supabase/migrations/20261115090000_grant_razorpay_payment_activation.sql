-- Allow the verified Razorpay Edge Function (service role only) to activate paid entitlements.
grant execute on function public.credit_connection_wallet_from_payment(uuid) to service_role;
grant execute on function public.finalize_professional_subscription_payment(uuid,text,text,text) to service_role;
