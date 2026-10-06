create table if not exists public.professional_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_inr numeric(12,2) not null default 0 check (price_inr >= 0),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','quarterly','annual')),
  status text not null default 'inactive' check (status in ('active','inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_subscriptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.professional_subscription_plans(id),
  status text not null default 'active' check (status in ('trial','active','past_due','cancelled','expired')),
  provider text,
  provider_order_id text,
  provider_payment_id text,
  started_at timestamptz not null default now(),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professional_subscriptions_professional_idx on public.professional_subscriptions(professional_id);
create index if not exists professional_subscriptions_status_idx on public.professional_subscriptions(status);

alter table public.professional_subscription_plans enable row level security;
alter table public.professional_subscriptions enable row level security;

create or replace function public.admin_subscription_plans()
returns table(
  plan_id uuid, code text, name text, description text, price_inr numeric,
  billing_interval text, status text, sort_order integer, subscriber_count bigint
)
language sql security definer set search_path=public
as $$
  select p.id,p.code,p.name,p.description,p.price_inr,p.billing_interval,p.status,p.sort_order,
    (select count(*) from public.professional_subscriptions s where s.plan_id=p.id and s.status in ('trial','active','past_due'))
  from public.professional_subscription_plans p
  where public.is_admin()
  order by p.sort_order,p.name
$$;

create or replace function public.admin_save_subscription_plan(
  p_action text, p_plan_id uuid default null, p_code text default null,
  p_name text default null, p_description text default null,
  p_price_inr numeric default 0, p_billing_interval text default 'monthly',
  p_active boolean default true, p_sort_order integer default 0
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('create','update','delete') then raise exception 'Invalid plan action'; end if;
  if p_action='delete' then
    if exists(select 1 from public.professional_subscriptions where plan_id=p_plan_id and status in ('trial','active','past_due'))
      then raise exception 'Cannot delete a plan with active subscribers'; end if;
    delete from public.professional_subscription_plans where id=p_plan_id;
    if not found then raise exception 'Subscription plan not found'; end if;
    return p_plan_id;
  end if;
  if coalesce(trim(p_code),'')='' or coalesce(trim(p_name),'')='' then raise exception 'Plan code and name are required'; end if;
  if p_price_inr is null or p_price_inr < 0 then raise exception 'Price cannot be negative'; end if;
  if p_billing_interval not in ('monthly','quarterly','annual') then raise exception 'Invalid billing interval'; end if;
  if p_action='create' then
    insert into public.professional_subscription_plans(code,name,description,price_inr,billing_interval,status,sort_order)
    values(lower(trim(p_code)),trim(p_name),nullif(trim(p_description),''),p_price_inr,p_billing_interval,case when p_active then 'active' else 'inactive' end,p_sort_order)
    returning id into v_id;
  else
    update public.professional_subscription_plans
    set code=lower(trim(p_code)),name=trim(p_name),description=nullif(trim(p_description),''),
        price_inr=p_price_inr,billing_interval=p_billing_interval,
        status=case when p_active then 'active' else 'inactive' end,
        sort_order=p_sort_order,updated_at=now()
    where id=p_plan_id returning id into v_id;
    if v_id is null then raise exception 'Subscription plan not found'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_subscription_list()
returns table(
 subscription_id uuid, professional_id uuid, professional_name text,
 plan_id uuid, plan_name text, price_inr numeric, billing_interval text,
 status text, started_at timestamptz, current_period_end timestamptz,
 provider text, provider_order_id text, provider_payment_id text
)
language sql security definer set search_path=public
as $$
 select s.id,s.professional_id,coalesce(pf.display_name,pf.full_name,'Professional'),
        p.id,p.name,p.price_inr,p.billing_interval,s.status,s.started_at,s.current_period_end,
        s.provider,s.provider_order_id,s.provider_payment_id
 from public.professional_subscriptions s
 join public.professional_subscription_plans p on p.id=s.plan_id
 left join public.profiles pf on pf.id=s.professional_id
 where public.is_admin()
 order by s.created_at desc
 limit 500
$$;

revoke all on function public.admin_subscription_plans() from public,anon,authenticated;
grant execute on function public.admin_subscription_plans() to authenticated;
revoke all on function public.admin_save_subscription_plan(text,uuid,text,text,text,numeric,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.admin_save_subscription_plan(text,uuid,text,text,text,numeric,text,boolean,integer) to authenticated;
revoke all on function public.admin_subscription_list() from public,anon,authenticated;
grant execute on function public.admin_subscription_list() to authenticated;
