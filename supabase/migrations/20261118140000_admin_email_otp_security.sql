create table if not exists public.admin_email_otp_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  last_sent_at timestamptz not null default now(),
  verified_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_email_otp_challenges enable row level security;
revoke all on table public.admin_email_otp_challenges from anon, authenticated;
grant all on table public.admin_email_otp_challenges to service_role;

create or replace function public.is_admin_email_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users a
    join public.admin_email_otp_challenges c on c.user_id = a.user_id
    where a.user_id = (select auth.uid())
      and c.verified_until > now()
  );
$$;

revoke all on function public.is_admin_email_verified() from public, anon;
grant execute on function public.is_admin_email_verified() to authenticated;

comment on table public.admin_email_otp_challenges is 'Server-managed short-lived email verification challenges for KAMPRO admin access. Never expose directly to clients.';
