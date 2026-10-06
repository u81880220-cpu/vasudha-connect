-- Free QA subscription path for end-to-end testing.
-- Production billing remains switchable to Razorpay later.

insert into public.professional_subscription_plans
  (code, name, description, price_inr, billing_interval, status, sort_order)
values
  ('qa_free', 'Free QA Subscription', 'Free test subscription for VASUDHA CONNECT end-to-end QA. No real payment is collected.', 0, 'monthly', 'active', -100)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    price_inr = excluded.price_inr,
    billing_interval = excluded.billing_interval,
    status = excluded.status,
    sort_order = excluded.sort_order;

drop policy if exists "professional subscription plans active read" on public.professional_subscription_plans;
create policy "professional subscription plans active read"
on public.professional_subscription_plans
for select
to authenticated
using (status = 'active');

drop policy if exists "professionals read own subscriptions" on public.professional_subscriptions;
create policy "professionals read own subscriptions"
on public.professional_subscriptions
for select
to authenticated
using ((select auth.uid()) = professional_id);

create or replace function public.activate_free_professional_subscription(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.professional_subscription_plans%rowtype;
  v_subscription uuid;
begin
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_plan
  from public.professional_subscription_plans
  where id = p_plan_id
    and status = 'active'
    and price_inr = 0
  limit 1;

  if v_plan.id is null then
    raise exception 'Free QA subscription plan not found';
  end if;

  insert into public.professional_subscriptions (
    professional_id,
    plan_id,
    status,
    provider,
    provider_order_id,
    provider_payment_id,
    started_at,
    current_period_start,
    current_period_end
  )
  values (
    v_user,
    v_plan.id,
    'active',
    'test',
    'qa_' || gen_random_uuid()::text,
    'qa_free',
    now(),
    now(),
    now() + interval '30 days'
  )
  on conflict (professional_id) do update
  set plan_id = excluded.plan_id,
      status = 'active',
      provider = 'test',
      provider_order_id = excluded.provider_order_id,
      provider_payment_id = 'qa_free',
      started_at = coalesce(public.professional_subscriptions.started_at, excluded.started_at),
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancelled_at = null,
      updated_at = now()
  returning id into v_subscription;

  return v_subscription;
end;
$$;

revoke all on function public.activate_free_professional_subscription(uuid) from public;
revoke all on function public.activate_free_professional_subscription(uuid) from anon;
grant execute on function public.activate_free_professional_subscription(uuid) to authenticated;
