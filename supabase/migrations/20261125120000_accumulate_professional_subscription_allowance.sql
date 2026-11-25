-- Accumulate unused professional connection allowance and extend active validity.
-- Existing subscription rows retain their current plan allowance on migration.
alter table public.professional_subscriptions
  add column if not exists connections_granted integer not null default 0;

update public.professional_subscriptions s
set connections_granted = p.connection_limit
from public.professional_subscription_plans p
where p.id = s.plan_id
  and coalesce(s.connections_granted, 0) = 0;

alter table public.professional_subscriptions
  drop constraint if exists professional_subscriptions_connections_granted_check;
alter table public.professional_subscriptions
  add constraint professional_subscriptions_connections_granted_check
  check (connections_granted >= 0);

create or replace function public.create_professional_subscription_payment_order(p_plan_id uuid)
returns table(id uuid, amount_inr numeric, plan_name text, billing_interval text)
language plpgsql security definer set search_path=public as $function$
declare
  v_id uuid; v_amount numeric; v_name text; v_interval text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'Professional account required';
  end if;

  select p.name,p.price_inr,p.billing_interval
    into v_name,v_amount,v_interval
  from public.professional_subscription_plans p
  where p.id=p_plan_id and p.status='active';
  if v_name is null then raise exception 'Subscription plan is not available'; end if;

  -- Lock the current row to serialize concurrent purchases; all active plans are purchasable.
  perform 1 from public.professional_subscriptions s
  where s.professional_id=auth.uid()
    and s.status in ('trial','active','past_due')
  order by s.created_at desc limit 1 for update;

  update public.professional_subscriptions
  set status='expired',updated_at=now()
  where professional_id=auth.uid()
    and status in ('active','past_due')
    and current_period_end is not null
    and current_period_end<=now();

  insert into public.professional_subscription_payment_orders(professional_id,plan_id,amount_inr)
  values(auth.uid(),p_plan_id,v_amount)
  returning professional_subscription_payment_orders.id into v_id;

  return query select v_id,v_amount,v_name,v_interval;
end;
$function$;

create or replace function public.finalize_professional_subscription_payment(
  p_order_id uuid,p_provider text,p_provider_order_id text,p_provider_payment_id text
) returns uuid language plpgsql security definer set search_path=public as $function$
declare
  v_prof uuid; v_plan uuid; v_status text; v_interval text; v_target_limit integer;
  v_sub uuid; v_now timestamptz:=now(); v_end timestamptz;
  v_current_end timestamptz; v_current_start timestamptz;
  v_current_used integer:=0; v_current_granted integer:=0; v_remaining integer:=0;
  v_new_granted integer;
begin
  select o.professional_id,o.plan_id,o.status,p.billing_interval,p.connection_limit
    into v_prof,v_plan,v_status,v_interval,v_target_limit
  from public.professional_subscription_payment_orders o
  join public.professional_subscription_plans p on p.id=o.plan_id
  where o.id=p_order_id for update of o;

  if v_prof is null then raise exception 'Subscription payment order not found'; end if;
  if v_status='paid' then
    select id into v_sub from public.professional_subscriptions
    where provider_order_id=p_provider_order_id limit 1;
    return v_sub;
  end if;
  if v_status in ('failed','cancelled','refunded') then
    raise exception 'Payment order cannot be finalized';
  end if;

  -- Serialize subscription changes for this professional and retain only the current row.
  perform pg_advisory_xact_lock(hashtextextended(v_prof::text, 0));

  update public.professional_subscriptions
  set status='expired',updated_at=v_now
  where professional_id=v_prof
    and status in ('active','past_due')
    and current_period_end is not null
    and current_period_end<=v_now;

  select s.id,s.current_period_start,s.current_period_end,
         coalesce(s.connections_used,0),
         greatest(coalesce(s.connections_granted,0),p.connection_limit)
    into v_sub,v_current_start,v_current_end,v_current_used,v_current_granted
  from public.professional_subscriptions s
  join public.professional_subscription_plans p on p.id=s.plan_id
  where s.professional_id=v_prof
    and s.status in ('trial','active','past_due')
    and s.current_period_end>v_now
  order by s.created_at desc limit 1 for update of s;

  if v_sub is not null then
    v_remaining:=greatest(v_current_granted-v_current_used,0);
    v_new_granted:=v_current_used+v_remaining+v_target_limit;
    v_end:=greatest(v_current_end,v_now)+case v_interval
      when 'monthly' then interval '1 month'
      when 'two_months' then interval '2 months'
      when 'quarterly' then interval '3 months'
      when 'annual' then interval '1 year'
      else null end;
    if v_interval not in ('monthly','two_months','quarterly','annual') then
      raise exception 'Unsupported subscription duration';
    end if;
  else
    v_new_granted:=v_target_limit;
    v_current_start:=v_now;
    v_end:=v_now+case v_interval
      when 'monthly' then interval '1 month'
      when 'two_months' then interval '2 months'
      when 'quarterly' then interval '3 months'
      when 'annual' then interval '1 year'
      else null end;
    if v_interval not in ('monthly','two_months','quarterly','annual') then
      raise exception 'Unsupported subscription duration';
    end if;
  end if;

  update public.professional_subscription_payment_orders
  set status='paid',provider=coalesce(p_provider,'razorpay'),
      provider_order_id=p_provider_order_id,provider_payment_id=p_provider_payment_id,updated_at=v_now
  where id=p_order_id;

  if v_sub is not null then
    update public.professional_subscriptions
    set plan_id=v_plan,status='active',provider=coalesce(p_provider,'razorpay'),
        provider_order_id=p_provider_order_id,provider_payment_id=p_provider_payment_id,
        current_period_start=coalesce(v_current_start,v_now),current_period_end=v_end,
        connections_granted=v_new_granted,cancelled_at=null,updated_at=v_now
    where id=v_sub;
  else
    insert into public.professional_subscriptions(
      professional_id,plan_id,status,provider,provider_order_id,provider_payment_id,
      started_at,current_period_start,current_period_end,connections_used,connections_granted
    ) values(
      v_prof,v_plan,'active',coalesce(p_provider,'razorpay'),p_provider_order_id,p_provider_payment_id,
      v_now,v_now,v_end,0,v_new_granted
    ) returning id into v_sub;
  end if;

  return v_sub;
end;
$function$;

create or replace function public.professional_connection_eligibility(p_professional_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare
  v_sub public.professional_subscriptions%rowtype;
  v_limit integer;
begin
  if p_professional_id is null then
    return jsonb_build_object('eligible', false, 'reason', 'Professional not found');
  end if;
  if not exists (
    select 1 from public.professional_profiles pp
    where pp.user_id=p_professional_id
      and pp.verification_status='verified'::public.verification_status
      and pp.is_available=true
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'This professional is currently unavailable');
  end if;

  select s.* into v_sub
  from public.professional_subscriptions s
  where s.professional_id=p_professional_id
    and s.status='active'
    and s.current_period_end>now()
  order by s.current_period_end desc,s.created_at desc
  limit 1;

  if v_sub.id is null then
    return jsonb_build_object('eligible', false, 'reason', 'This professional’s subscription has expired. They must renew their subscription before customers can connect.');
  end if;

  select greatest(coalesce(v_sub.connections_granted,0),p.connection_limit)
    into v_limit
  from public.professional_subscription_plans p
  where p.id=v_sub.plan_id and p.status='active';

  if v_limit is null then
    return jsonb_build_object('eligible', false, 'reason', 'This professional’s subscription plan is unavailable.');
  end if;
  if v_sub.connections_used>=v_limit then
    return jsonb_build_object('eligible', false, 'reason', 'This professional has reached the connection limit for the current subscription period. They must renew or purchase another plan before customers can connect.');
  end if;
  return jsonb_build_object('eligible', true, 'reason', null);
end;
$function$;

create or replace function public.enforce_professional_connection_allowance()
returns trigger language plpgsql security definer set search_path=public as $function$
declare
  v_connection public.professional_connections%rowtype;
  v_sub public.professional_subscriptions%rowtype;
  v_limit integer; v_price numeric; v_interval text; v_new_end timestamptz;
begin
  if new.customer_id is null or new.professional_id is null then
    raise exception 'Customer and professional are required';
  end if;

  select * into v_connection from public.professional_connections
  where customer_id=new.customer_id and professional_id=new.professional_id and expires_at>now()
  for update;

  if not found then
    raise exception 'Unlock this professional with a connection credit before creating a job request';
  end if;
  if v_connection.last_job_request_id is not null then
    perform public.consume_customer_connection_credit(new.customer_id);
    update public.professional_connections
    set expires_at=now()+interval '30 days',purchased_at=now(),last_accessed_at=now()
    where id=v_connection.id;
  end if;

  select * into v_sub from public.professional_subscriptions
  where professional_id=new.professional_id and status='active'
  order by current_period_end desc,created_at desc limit 1 for update;
  if v_sub.id is null then
    raise exception 'Professional subscription is not active. Please ask the professional to renew or choose a plan.';
  end if;

  select greatest(coalesce(s.connections_granted,0),p.connection_limit),p.price_inr,p.billing_interval
    into v_limit,v_price,v_interval
  from public.professional_subscription_plans p
  where p.id=v_sub.plan_id;

  if v_limit is null then raise exception 'Professional subscription plan is unavailable'; end if;

  if v_sub.current_period_end is not null and v_sub.current_period_end<=now() then
    if coalesce(v_price,0)=0 then
      v_new_end:=case v_interval
        when 'monthly' then now()+interval '1 month'
        when 'two_months' then now()+interval '2 months'
        when 'quarterly' then now()+interval '3 months'
        when 'annual' then now()+interval '1 year'
        else now()+interval '2 months' end;
      update public.professional_subscriptions
      set current_period_start=now(),current_period_end=v_new_end,
          connections_used=0,connections_granted=v_limit,updated_at=now(),status='active'
      where id=v_sub.id returning * into v_sub;
    else
      update public.professional_subscriptions set status='expired',updated_at=now() where id=v_sub.id;
      raise exception 'Professional subscription expired. Please renew to receive new job requests.';
    end if;
  end if;

  if v_sub.connections_used>=v_limit then
    raise exception 'Professional has reached the connection limit for the current subscription period';
  end if;

  update public.professional_subscriptions
  set connections_used=connections_used+1,updated_at=now()
  where id=v_sub.id;
  new.professional_subscription_id:=v_sub.id;
  new.professional_connection_counted_at:=now();
  return new;
end;
$function$;

create or replace function public.admin_subscription_list()
returns table(
  subscription_id uuid,professional_id uuid,professional_name text,plan_id uuid,plan_name text,
  price_inr numeric,billing_interval text,status text,started_at timestamptz,current_period_end timestamptz,
  provider text,provider_order_id text,provider_payment_id text,connections_used integer,connection_limit integer
)
language sql security definer set search_path=public as $function$
  select s.id,s.professional_id,coalesce(pf.display_name,pf.full_name,'Professional'),
         p.id,p.name,p.price_inr,p.billing_interval,s.status,s.started_at,s.current_period_end,
         s.provider,s.provider_order_id,s.provider_payment_id,s.connections_used,
         greatest(coalesce(s.connections_granted,0),p.connection_limit)
  from public.professional_subscriptions s
  join public.professional_subscription_plans p on p.id=s.plan_id
  left join public.profiles pf on pf.id=s.professional_id
  where public.is_admin()
  order by s.created_at desc limit 500
$function$;

revoke all on function public.create_professional_subscription_payment_order(uuid) from public,anon;
grant execute on function public.create_professional_subscription_payment_order(uuid) to authenticated;
revoke all on function public.finalize_professional_subscription_payment(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_professional_subscription_payment(uuid,text,text,text) to service_role;
