create table if not exists public.marketing_offers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  applies_to text not null default 'both' check (applies_to in ('customer_connections','professional_subscription','both')),
  min_purchase_inr numeric(10,2) not null default 0 check (min_purchase_inr >= 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'inactive' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_offers_percentage_max check (discount_type <> 'percentage' or discount_value <= 100),
  constraint marketing_offers_date_order check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists marketing_offers_status_dates_idx
  on public.marketing_offers (status, starts_at, ends_at);

alter table public.marketing_offers enable row level security;

drop policy if exists "Active offers are readable" on public.marketing_offers;
create policy "Active offers are readable"
  on public.marketing_offers for select
  to anon, authenticated
  using (status = 'active' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

drop policy if exists "Admins manage marketing offers" on public.marketing_offers;
create policy "Admins manage marketing offers"
  on public.marketing_offers for all
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant select on public.marketing_offers to anon, authenticated;
grant insert, update, delete on public.marketing_offers to authenticated;