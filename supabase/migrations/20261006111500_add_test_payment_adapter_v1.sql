insert into public.app_settings(key,value,description,is_public)
values('connection_payment_test_mode','false'::jsonb,'Enables the free test payment adapter. Keep disabled for production.',false)
on conflict(key) do nothing;

create or replace function public.finalize_test_connection_payment(p_order_id uuid)
returns public.connection_payment_orders
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.connection_payment_orders;
  v_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select coalesce((value #>> '{}')::boolean,false) into v_enabled
  from public.app_settings where key='connection_payment_test_mode';
  if not v_enabled then raise exception 'Test payment mode is disabled'; end if;

  select * into v_order
  from public.connection_payment_orders
  where id=p_order_id and customer_id=auth.uid()
  for update;
  if not found then raise exception 'Payment order not found'; end if;
  if v_order.status='paid' then return v_order; end if;

  update public.connection_payment_orders
  set status='paid',provider='test',provider_order_id='TEST-'||p_order_id::text,
      provider_payment_id='TEST-PAY-'||p_order_id::text,paid_at=now()
  where id=p_order_id
  returning * into v_order;

  perform public.credit_connection_wallet_from_payment(p_order_id);
  return v_order;
end;
$$;

revoke all on function public.finalize_test_connection_payment(uuid) from public;
revoke all on function public.finalize_test_connection_payment(uuid) from anon;
grant execute on function public.finalize_test_connection_payment(uuid) to authenticated;
