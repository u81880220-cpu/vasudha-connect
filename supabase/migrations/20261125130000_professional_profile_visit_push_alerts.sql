-- Record customer views of professional profiles and nudge professionals whose
-- subscription is not currently active. Visitor identity is never included in
-- the notification payload.
create table if not exists public.professional_profile_visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint professional_profile_visits_not_self check (customer_id <> professional_id)
);

create index if not exists professional_profile_visits_professional_created_idx
  on public.professional_profile_visits (professional_id, created_at desc);

alter table public.professional_profile_visits enable row level security;
revoke all on table public.professional_profile_visits from anon, authenticated;

create or replace function public.record_professional_profile_visit(p_professional_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
begin
  if v_customer_id is null then
    raise exception 'authentication required';
  end if;
  if p_professional_id is null or p_professional_id = v_customer_id then
    return false;
  end if;
  if not exists (
    select 1 from public.professional_profiles
    where user_id = p_professional_id
  ) then
    return false;
  end if;

  insert into public.professional_profile_visits(customer_id, professional_id)
  values (v_customer_id, p_professional_id);

  if not exists (
    select 1
    from public.professional_subscriptions s
    where s.professional_id = p_professional_id
      and s.status = 'active'
      and s.current_period_end > now()
  ) then
    perform public._create_notification_internal(
      p_professional_id,
      'system',
      'A customer viewed your KAMPRO profile',
      'A customer viewed your profile. Renew your subscription to receive new customer connections.',
      jsonb_build_object('event', 'professional_profile_visit')
    );
  end if;

  return true;
end;
$$;

revoke all on function public.record_professional_profile_visit(uuid) from public, anon;
grant execute on function public.record_professional_profile_visit(uuid) to authenticated;
