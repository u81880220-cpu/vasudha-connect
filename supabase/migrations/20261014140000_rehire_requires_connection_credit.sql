-- KAMPRO: every rehire consumes one connection credit, even when the customer
-- already has an active connection with the same professional.
create table if not exists public.rehire_connection_attempts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.professional_connections(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(customer_id, request_key)
);
alter table public.rehire_connection_attempts enable row level security;
revoke all on public.rehire_connection_attempts from public, anon, authenticated;

create or replace function public.create_rehire_connection(p_job_id uuid, p_request_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_professional_id uuid;
  v_connection_id uuid;
  v_balance integer;
  v_attempt_id uuid;
begin
  if v_customer_id is null then
    raise exception 'Authentication required';
  end if;

  select j.professional_id
    into v_professional_id
  from public.jobs j
  where j.id = p_job_id
    and j.customer_id = v_customer_id
    and j.status = 'customer_confirmed'
    and j.professional_id is not null
  for update;

  if v_professional_id is null then
    raise exception 'Only a completed job can be rehired';
  end if;

  if nullif(trim(p_request_key), '') is null or length(p_request_key) > 120 then
    raise exception 'A valid rehire request key is required';
  end if;

  if not exists (
    select 1 from public.professional_profiles pp
    where pp.user_id = v_professional_id
      and pp.verification_status = 'verified'::verification_status
      and pp.is_available = true
  ) then
    raise exception 'Professional is not currently available';
  end if;

  insert into public.rehire_connection_attempts(customer_id, request_key, job_id, professional_id)
  values(v_customer_id, trim(p_request_key), p_job_id, v_professional_id)
  on conflict(customer_id, request_key) do nothing
  returning id into v_attempt_id;

  if v_attempt_id is null then
    select connection_id into v_connection_id
    from public.rehire_connection_attempts
    where customer_id = v_customer_id and request_key = trim(p_request_key);
    if v_connection_id is null then
      raise exception 'The rehire request is still being processed. Please refresh My Jobs.';
    end if;
    return v_connection_id;
  end if;

  update public.connection_wallets
  set balance = balance - 1,
      updated_at = now()
  where user_id = v_customer_id
    and balance > 0
  returning balance into v_balance;

  if not found then
    raise exception 'No connection credits available';
  end if;

  update public.professional_connections
  set expires_at = now() + interval '30 days',
      last_accessed_at = now(),
      purchased_at = now()
  where customer_id = v_customer_id
    and professional_id = v_professional_id
  returning id into v_connection_id;

  if v_connection_id is null then
    insert into public.professional_connections(
      customer_id, professional_id, expires_at, last_accessed_at, purchased_at
    )
    values (
      v_customer_id, v_professional_id, now() + interval '30 days', now(), now()
    )
    on conflict(customer_id, professional_id) do update
      set expires_at = excluded.expires_at,
          last_accessed_at = now(),
          purchased_at = now()
    returning id into v_connection_id;
  end if;

  update public.rehire_connection_attempts
  set connection_id = v_connection_id
  where id = v_attempt_id;

  return v_connection_id;
end;
$$;

revoke all on function public.create_rehire_connection(uuid, text) from public, anon;
grant execute on function public.create_rehire_connection(uuid, text) to authenticated;
