-- Keep the unlock-time allowance identical to the subscription display and
-- eligibility check. Carried-forward grants must not be capped by the base plan.
create or replace function public.unlock_professional(p_professional_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sub public.professional_subscriptions%rowtype;
  v_limit integer;
  v_check jsonb;
  v_mode public.app_mode;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select current_mode into v_mode
  from public.profiles
  where id = auth.uid();

  if v_mode is distinct from 'customer'::public.app_mode then
    raise exception 'Switch to Customer mode to unlock another professional.';
  end if;

  if auth.uid() = p_professional_id then
    raise exception 'You cannot unlock your own professional profile';
  end if;

  v_check := public.professional_connection_eligibility(p_professional_id);
  if coalesce((v_check->>'eligible')::boolean, false) is not true then
    raise exception '%', coalesce(v_check->>'reason', 'This professional cannot receive new customer connections right now.');
  end if;

  if exists (
    select 1
    from public.professional_connections
    where customer_id = auth.uid()
      and professional_id = p_professional_id
      and expires_at > now()
  ) then
    update public.professional_connections
    set last_accessed_at = now(), expires_at = 'infinity'::timestamptz
    where customer_id = auth.uid()
      and professional_id = p_professional_id;
    return true;
  end if;

  select s.* into v_sub
  from public.professional_subscriptions s
  where s.professional_id = p_professional_id
    and s.status = 'active'
    and s.current_period_end > now()
  order by s.current_period_end desc, s.created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    raise exception 'This professional cannot receive new job requests right now';
  end if;

  -- Important: use the carried-forward grant where it exceeds the plan's
  -- base connection limit, matching professional_connection_eligibility().
  select greatest(coalesce(v_sub.connections_granted, 0), p.connection_limit)
    into v_limit
  from public.professional_subscription_plans p
  where p.id = v_sub.plan_id
    and p.status = 'active';

  if v_limit is null then
    raise exception 'Professional subscription plan is unavailable';
  end if;

  if v_sub.connections_used >= v_limit then
    raise exception 'This professional has reached the connection limit for this subscription period';
  end if;

  perform public.consume_customer_connection_credit(auth.uid());

  insert into public.professional_connections(
    customer_id, professional_id, expires_at, last_accessed_at
  )
  values (
    auth.uid(), p_professional_id, 'infinity'::timestamptz, now()
  )
  on conflict (customer_id, professional_id) do update
  set expires_at = 'infinity'::timestamptz,
      last_accessed_at = now(),
      purchased_at = now(),
      last_job_request_id = null;

  return true;
end;
$function$;
