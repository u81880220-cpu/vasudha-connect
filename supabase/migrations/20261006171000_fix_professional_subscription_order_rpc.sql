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
 insert into public.professional_subscription_payment_orders(professional_id,plan_id,amount_inr) values(auth.uid(),p_plan_id,v_amount) returning professional_subscription_payment_orders.id into v_id;
 return query select v_id,v_amount,v_name,v_interval;
end; $function$;
revoke all on function public.create_professional_subscription_payment_order(uuid) from public,anon;
grant execute on function public.create_professional_subscription_payment_order(uuid) to authenticated;