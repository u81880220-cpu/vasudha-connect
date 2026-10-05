do $$ begin
  create type public.connection_payment_status as enum ('created','pending','paid','failed','cancelled','refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.connection_payment_orders (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id) on delete cascade,
 package_code public.connection_package_code not null references public.connection_packages(code),
 amount_inr numeric(10,2) not null check(amount_inr>0),
 status public.connection_payment_status not null default 'created',
 provider text,
 provider_order_id text,
 provider_payment_id text,
 created_at timestamptz not null default now(),
 paid_at timestamptz,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists connection_payment_orders_customer_idx
 on public.connection_payment_orders(customer_id,created_at desc);

alter table public.connection_payment_orders enable row level security;
drop policy if exists "customers read own connection payment orders" on public.connection_payment_orders;
create policy "customers read own connection payment orders"
 on public.connection_payment_orders for select to authenticated using(customer_id=auth.uid());
grant select on public.connection_payment_orders to authenticated;

create or replace function public.create_connection_payment_order(p_package public.connection_package_code)
returns public.connection_payment_orders
language plpgsql security definer set search_path=public
as $$
declare v_order public.connection_payment_orders; v_price numeric(10,2);
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select price_inr into v_price from public.connection_packages
 where code=p_package and is_active=true;
 if v_price is null then raise exception 'Package unavailable'; end if;
 insert into public.connection_payment_orders(customer_id,package_code,amount_inr)
 values(auth.uid(),p_package,v_price) returning * into v_order;
 return v_order;
end;
$$;
revoke execute on function public.create_connection_payment_order(public.connection_package_code) from anon;
grant execute on function public.create_connection_payment_order(public.connection_package_code) to authenticated;
