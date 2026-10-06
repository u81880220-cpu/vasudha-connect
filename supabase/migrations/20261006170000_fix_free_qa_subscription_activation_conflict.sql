create or replace function public.activate_free_professional_subscription(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
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

  select id into v_subscription
  from public.professional_subscriptions
  where professional_id = v_user
  order by created_at desc
  limit 1
  for update;

  if v_subscription is not null then
    update public.professional_subscriptions
    set plan_id = v_plan.id,
        status = 'active',
        provider = 'test',
        provider_order_id = 'qa_' || gen_random_uuid()::text,
        provider_payment_id = 'qa_free',
        started_at = coalesce(started_at, now()),
        current_period_start = now(),
        current_period_end = now() + interval '30 days',
        cancelled_at = null,
        updated_at = now()
    where id = v_subscription
    returning id into v_subscription;
  else
    insert into public.professional_subscriptions (
      professional_id, plan_id, status, provider, provider_order_id,
      provider_payment_id, started_at, current_period_start, current_period_end
    )
    values (
      v_user, v_plan.id, 'active', 'test', 'qa_' || gen_random_uuid()::text,
      'qa_free', now(), now(), now() + interval '30 days'
    )
    returning id into v_subscription;
  end if;

  return v_subscription;
end;
$function$;