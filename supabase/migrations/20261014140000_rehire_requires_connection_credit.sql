-- KAMPRO: every rehire consumes one connection credit, even when the customer
-- already has an active connection with the same professional.
create or replace function public.create_rehire_connection(p_job_id uuid)
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
      last_accessed_at = now()
  where customer_id = v_customer_id
    and professional_id = v_professional_id
  returning id into v_connection_id;

  if v_connection_id is null then
    insert into public.professional_connections(
      customer_id, professional_id, expires_at, last_accessed_at
    )
    values (
      v_customer_id, v_professional_id, now() + interval '30 days', now()
    )
    returning id into v_connection_id;
  end if;

  return v_connection_id;
end;
$$;

revoke all on function public.create_rehire_connection(uuid) from public, anon;
grant execute on function public.create_rehire_connection(uuid) to authenticated;
