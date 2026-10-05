-- Fix payment crediting to match the current purchase schema and make webhook
-- processing idempotent for the same payment order.
alter table public.connection_purchases
  add column if not exists payment_order_id uuid references public.connection_payment_orders(id);

create unique index if not exists connection_purchases_payment_order_uidx
  on public.connection_purchases(payment_order_id)
  where payment_order_id is not null;

create or replace function public.credit_connection_wallet_from_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.connection_payment_orders;
  v_pkg public.connection_packages;
begin
  select * into v_order
  from public.connection_payment_orders
  where id=p_order_id
  for update;

  if not found or v_order.status<>'paid' then
    raise exception 'Payment not settled';
  end if;

  if exists (select 1 from public.connection_purchases where payment_order_id=p_order_id) then
    return;
  end if;

  select * into v_pkg
  from public.connection_packages
  where code=v_order.package_code;

  if not found then
    raise exception 'Package not found';
  end if;

  insert into public.connection_purchases(
    user_id,package_code,connections,price_inr,purchased_at,expires_at,payment_order_id
  )
  values(
    v_order.customer_id,v_pkg.code,v_pkg.connections,v_order.amount_inr,
    now(),now()+make_interval(days=>v_pkg.validity_days),p_order_id
  );

  insert into public.connection_wallets(user_id,balance)
  values(v_order.customer_id,v_pkg.connections)
  on conflict(user_id) do update
    set balance=public.connection_wallets.balance+excluded.balance,
        updated_at=now();
end;
$$;

revoke all on function public.credit_connection_wallet_from_payment(uuid) from public,anon,authenticated;
