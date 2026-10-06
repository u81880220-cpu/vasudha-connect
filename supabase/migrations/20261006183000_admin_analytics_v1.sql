create or replace function public.admin_analytics()
returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object(
 'users',(select count(*) from public.profiles),
 'professionals',(select count(*) from public.professional_profiles),
 'verified_professionals',(select count(*) from public.professional_profiles where verification_status='verified'),
 'active_connections',(select count(*) from public.professional_connections where expires_at>now()),
 'connection_unlocks',(select count(*) from public.connection_purchases),
 'active_subscriptions',(select count(*) from public.professional_subscriptions where status='active'),
 'subscription_count',(select count(*) from public.professional_subscriptions),
 'jobs',(select count(*) from public.jobs),
 'completed_jobs',(select count(*) from public.jobs where status in ('work_completed','customer_confirmed')),
 'reviews',(select count(*) from public.job_reviews),
 'connection_revenue',(select coalesce(sum(amount_inr),0) from public.connection_payment_orders where status='paid'),
 'subscription_revenue',(select coalesce(sum(amount_inr),0) from public.professional_subscription_payment_orders where status='paid'),
 'connection_revenue_30d',(select coalesce(sum(amount_inr),0) from public.connection_payment_orders where status='paid' and paid_at>=now()-interval '30 days'),
 'subscription_revenue_30d',(select coalesce(sum(amount_inr),0) from public.professional_subscription_payment_orders where status='paid' and created_at>=now()-interval '30 days'),
 'new_users_30d',(select count(*) from public.profiles where created_at>=now()-interval '30 days'),
 'new_professionals_30d',(select count(*) from public.professional_profiles where created_at>=now()-interval '30 days'),
 'new_connections_30d',(select count(*) from public.professional_connections where purchased_at>=now()-interval '30 days')
);
$$;
revoke all on function public.admin_analytics() from public,anon,authenticated;
grant execute on function public.admin_analytics() to authenticated;
