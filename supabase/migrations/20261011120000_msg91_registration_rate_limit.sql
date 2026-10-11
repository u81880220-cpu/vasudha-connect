-- MSG91 registration abuse protection. This migration is intentionally on the
-- MSG91 feature branch only; do not apply to production until reviewed/tested.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.msg91_registration_rate_limits (
  phone_hash text primary key check (phone_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts >= 1),
  updated_at timestamptz not null default now()
);

revoke all on private.msg91_registration_rate_limits from public, anon, authenticated, service_role;
alter table private.msg91_registration_rate_limits enable row level security;

create or replace function public.msg91_registration_rate_limit(p_phone_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_allowed boolean;
begin
  if p_phone_hash is null or p_phone_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  insert into private.msg91_registration_rate_limits as r
    (phone_hash, window_started_at, attempts, updated_at)
  values (p_phone_hash, v_now, 1, v_now)
  on conflict (phone_hash) do update
    set window_started_at = case
          when r.window_started_at <= v_now - interval '15 minutes' then v_now
          else r.window_started_at
        end,
        attempts = case
          when r.window_started_at <= v_now - interval '15 minutes' then 1
          else r.attempts + 1
        end,
        updated_at = v_now
  returning attempts <= 10 into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.msg91_registration_rate_limit(text) from public, anon, authenticated;
grant execute on function public.msg91_registration_rate_limit(text) to service_role;
