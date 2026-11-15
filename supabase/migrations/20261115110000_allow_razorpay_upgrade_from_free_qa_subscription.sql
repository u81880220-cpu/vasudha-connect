-- Allow professionals on the free QA plan to upgrade to a paid Razorpay plan.
-- Keep the one-current-subscription invariant by upgrading the existing row in place.

create or replace function public.create_professional_subscription_payment_order(p_plan_id uuid)
returns table(id uuid, amount_inr numeric, plan_name text, billing_interval text)
language plpgsql security definer set search_path=public as $function$
declare
 v_id uuid; v_amount numeric; v_name text; v_interval text;
 v_current_price numeric; v_current_code text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'Professional account required'; end if;
 select p.name,p.price_inr,p.billing_interval into v_name,v_amount,v_interval
 from public.professional_subscription_plans p where p.id=p_plan_id and p.status='active';
 if v_name is null then raise exception 'Subscription plan is not available'; end if;
 select p.price_inr,p.code into v_current_price,v_current_code
 from public.professional_subscriptions s
 join public.professional_subscription_plans p on p.id=s.plan_id
 where s.professional_id=auth.uid() and s.status in ('trial','active','past_due')
 order by s.created_at desc limit 1 for update of s;
 if v_current_price is not null and v_current_price > 0 then
   raise exception 'You already have an active paid subscription';
 end if;
 insert into public.professional_subscription_payment_orders(professional_id,plan_id,amount_inr)
 values(auth.uid(),p_plan_id,v_amount) returning professional_subscription_payment_orders.id into v_id;
 return query select v_id,v_amount,v_name,v_interval;
end; $function$;

create or replace function public.finalize_professional_subscription_payment(
 p_order_id uuid,p_provider text,p_provider_order_id text,p_provider_payment_id text
) returns uuid language plpgsql security definer set search_path=public as $function$
declare
 v_prof uuid; v_plan uuid; v_status text; v_interval text; v_sub uuid;
 v_start timestamptz:=now(); v_end timestamptz; v_existing_status text; v_existing_price numeric;
begin
 select o.professional_id,o.plan_id,o.status,p.billing_interval
 into v_prof,v_plan,v_status,v_interval
 from public.professional_subscription_payment_orders o
 join public.professional_subscription_plans p on p.id=o.plan_id
 where o.id=p_order_id for update of o;
 if v_prof is null then raise exception 'Subscription payment order not found'; end if;
 if v_status='paid' then
   select id into v_sub from public.professional_subscriptions where provider_order_id=p_provider_order_id limit 1;
   return v_sub;
 end if;
 if v_status in ('failed','cancelled','refunded') then raise exception 'Payment order cannot be finalized'; end if;
 select s.id,s.status,p.price_inr into v_sub,v_existing_status,v_existing_price
 from public.professional_subscriptions s
 join public.professional_subscription_plans p on p.id=s.plan_id
 where s.professional_id=v_prof and s.status in ('trial','active','past_due')
 order by s.created_at desc limit 1 for update of s;
 if v_existing_price is not null and v_existing_price > 0 then
   raise exception 'Professional already has an active paid subscription';
 end if;
 v_end:=case v_interval when 'monthly' then v_start+interval '1 month'
 when 'quarterly' then v_start+interval '3 months'
 when 'annual' then v_start+interval '1 year' end;
 update public.professional_subscription_payment_orders
 set status='paid',provider=coalesce(p_provider,'razorpay'),
 provider_order_id=p_provider_order_id,provider_payment_id=p_provider_payment_id,updated_at=now()
 where id=p_order_id;
 if v_sub is not null then
   update public.professional_subscriptions
   set plan_id=v_plan,status='active',provider=coalesce(p_provider,'razorpay'),
       provider_order_id=p_provider_order_id,provider_payment_id=p_provider_payment_id,
       started_at=v_start,current_period_start=v_start,current_period_end=v_end,
       cancelled_at=null,updated_at=now()
   where id=v_sub;
 else
   insert into public.professional_subscriptions(
     professional_id,plan_id,status,provider,provider_order_id,provider_payment_id,
     started_at,current_period_start,current_period_end,created_at,updated_at
   ) values(
     v_prof,v_plan,'active',coalesce(p_provider,'razorpay'),p_provider_order_id,p_provider_payment_id,
     v_start,v_start,v_end,v_start,v_start
   ) returning id into v_sub;
 end if;
 return v_sub;
end; $function$;
revoke all on function public.create_professional_subscription_payment_order(uuid) from public,anon;
grant execute on function public.create_professional_subscription_payment_order(uuid) to authenticated;
revoke all on function public.finalize_professional_subscription_payment(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_professional_subscription_payment(uuid,text,text,text) to service_role;
