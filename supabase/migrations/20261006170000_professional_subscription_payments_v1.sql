create table if not exists public.professional_subscription_payment_orders (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id),
  plan_id uuid not null references public.professional_subscription_plans(id),
  amount_inr numeric not null check (amount_inr >= 0),
  currency text not null default 'INR',
  status public.connection_payment_status not null default 'created',
  provider text,
  provider_order_id text unique,
  provider_payment_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists professional_subscription_payment_orders_professional_idx on public.professional_subscription_payment_orders(professional_id, created_at desc);
create unique index if not exists professional_subscriptions_one_current_idx on public.professional_subscriptions(professional_id) where status in ('trial','active','past_due');
alter table public.professional_subscription_payment_orders enable row level security;
create or replace function public.create_professional_subscription_payment_order(p_plan_id uuid)
returns table(id uuid, amount_inr numeric, plan_name text, billing_interval text)
language plpgsql security definer set search_path=public as $function$
declare v_id uuid; v_amount numeric; v_name text; v_interval text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'Professional account required'; end if;
 select p.name,p.price_inr,p.billing_interval into v_name,v_amount,v_interval from public.professional_subscription_plans p where p.id=p_plan_id and p.status='active';
 if v_name is null then raise exception 'Subscription plan is not available'; end if;
 if exists(select 1 from public.professional_subscriptions s where s.professional_id=auth.uid() and s.status in ('trial','active','past_due')) then raise exception 'You already have an active subscription'; end if;
 insert into public.professional_subscription_payment_orders(professional_id,plan_id,amount_inr) values(auth.uid(),p_plan_id,v_amount) returning id into v_id;
 return query select v_id,v_amount,v_name,v_interval;
end; $function$;
revoke all on function public.create_professional_subscription_payment_order(uuid) from public,anon;
grant execute on function public.create_professional_subscription_payment_order(uuid) to authenticated;
create or replace function public.finalize_professional_subscription_payment(p_order_id uuid,p_provider text,p_provider_order_id text,p_provider_payment_id text)
returns uuid language plpgsql security definer set search_path=public as $function$
declare v_prof uuid; v_plan uuid; v_status text; v_interval text; v_sub uuid; v_start timestamptz:=now(); v_end timestamptz;
begin
 select o.professional_id,o.plan_id,o.status,p.billing_interval into v_prof,v_plan,v_status,v_interval from public.professional_subscription_payment_orders o join public.professional_subscription_plans p on p.id=o.plan_id where o.id=p_order_id for update;
 if v_prof is null then raise exception 'Subscription payment order not found'; end if;
 if v_status='paid' then select id into v_sub from public.professional_subscriptions where provider_order_id=p_provider_order_id limit 1; return v_sub; end if;
 if v_status in ('failed','cancelled','refunded') then raise exception 'Payment order cannot be finalized'; end if;
 if exists(select 1 from public.professional_subscriptions where professional_id=v_prof and status in ('trial','active','past_due')) then raise exception 'Professional already has an active subscription'; end if;
 v_end:=case v_interval when 'monthly' then v_start+interval '1 month' when 'quarterly' then v_start+interval '3 months' when 'annual' then v_start+interval '1 year' end;
 update public.professional_subscription_payment_orders set status='paid',provider=coalesce(p_provider,'razorpay'),provider_order_id=p_provider_order_id,provider_payment_id=p_provider_payment_id,updated_at=now() where id=p_order_id;
 insert into public.professional_subscriptions(professional_id,plan_id,status,provider,provider_order_id,provider_payment_id,started_at,current_period_start,current_period_end,created_at,updated_at)
 values(v_prof,v_plan,'active',coalesce(p_provider,'razorpay'),p_provider_order_id,p_provider_payment_id,v_start,v_start,v_end,v_start,v_start) returning id into v_sub;
 return v_sub;
end; $function$;
revoke all on function public.finalize_professional_subscription_payment(uuid,text,text,text) from public,anon,authenticated;
create or replace function public.admin_subscription_payment_orders()
returns table(order_id uuid,professional_id uuid,professional_name text,plan_id uuid,plan_name text,amount_inr numeric,status text,provider text,provider_order_id text,provider_payment_id text,created_at timestamptz,updated_at timestamptz)
language sql security definer set search_path=public as $function$
 select o.id,o.professional_id,coalesce(pf.display_name,pf.full_name,'Professional'),o.plan_id,p.name,o.amount_inr,o.status::text,o.provider,o.provider_order_id,o.provider_payment_id,o.created_at,o.updated_at
 from public.professional_subscription_payment_orders o join public.professional_subscription_plans p on p.id=o.plan_id left join public.profiles pf on pf.id=o.professional_id
 where public.is_admin() order by o.created_at desc limit 500
$function$;
revoke all on function public.admin_subscription_payment_orders() from public,anon,authenticated;
grant execute on function public.admin_subscription_payment_orders() to authenticated;