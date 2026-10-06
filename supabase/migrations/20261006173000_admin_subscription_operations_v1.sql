create or replace function public.admin_set_professional_subscription_status(
 p_subscription_id uuid,p_status text
) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_status not in ('active','past_due','cancelled','expired') then raise exception 'Invalid subscription status'; end if;
 update public.professional_subscriptions set status=p_status,cancelled_at=case when p_status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end,updated_at=now() where id=p_subscription_id;
 if not found then raise exception 'Subscription not found'; end if;
end; $$;
revoke all on function public.admin_set_professional_subscription_status(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_set_professional_subscription_status(uuid,text) to authenticated;

create or replace function public.admin_extend_professional_subscription(
 p_subscription_id uuid,p_days integer
) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_days < 1 or p_days > 365 then raise exception 'Extension must be between 1 and 365 days'; end if;
 update public.professional_subscriptions set current_period_end=greatest(coalesce(current_period_end,now()),now())+make_interval(days=>p_days),status='active',updated_at=now() where id=p_subscription_id;
 if not found then raise exception 'Subscription not found'; end if;
end; $$;
revoke all on function public.admin_extend_professional_subscription(uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_extend_professional_subscription(uuid,integer) to authenticated;