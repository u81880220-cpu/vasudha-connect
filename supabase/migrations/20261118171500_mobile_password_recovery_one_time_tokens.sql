-- One-time, non-reversible claims for MSG91 mobile password recovery.
-- Only the server-side service_role may write; clients cannot read or modify claims.
create table if not exists public.mobile_password_recovery_claims (
  token_hash text primary key,
  phone_e164 text not null,
  consumed_at timestamptz not null default now()
);

alter table public.mobile_password_recovery_claims enable row level security;
revoke all on table public.mobile_password_recovery_claims from public, anon, authenticated;
grant all on table public.mobile_password_recovery_claims to service_role;

comment on table public.mobile_password_recovery_claims is
  'One-time hashes of MSG91 access tokens consumed for mobile password recovery. Raw tokens are never stored.';
