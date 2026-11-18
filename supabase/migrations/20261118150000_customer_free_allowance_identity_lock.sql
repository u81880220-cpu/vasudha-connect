-- Prevent repeat customer welcome credits after account deletion/recreation.
-- Identity values are stored only as keyed HMACs; the secret lives in Supabase Vault.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.customer_free_allowance_claims (
  identifier_type text not null check (identifier_type in ('email','phone')),
  identifier_hash text not null,
  claimed_by_user_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (identifier_type, identifier_hash)
);
revoke all on private.customer_free_allowance_claims from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'kampro_free_allowance_hmac_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'kampro_free_allowance_hmac_key', 'HMAC key for one-time customer free connection allowance identity hashes');
  end if;
end $$;

create or replace function public.grant_customer_welcome_connection()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, vault
as $function$
declare
  v_email_hash text;
  v_phone_hash text;
  v_secret text;
  v_claimed_by uuid;
  v_blocked boolean := false;
  v_has_identifier boolean := false;
begin
  if new.current_mode <> 'customer' then
    return new;
  end if;

  select
    case when u.email is not null and u.email_confirmed_at is not null then lower(btrim(u.email)) end,
    case when u.phone is not null and u.phone_confirmed_at is not null then regexp_replace(u.phone, '[^0-9+]', '', 'g') end
  into v_email_hash, v_phone_hash
  from auth.users u
  where u.id = new.id;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'kampro_free_allowance_hmac_key'
  limit 1;

  if v_secret is null then
    raise exception 'Free allowance identity protection is not configured';
  end if;

  if v_email_hash is not null and v_email_hash <> '' then
    v_has_identifier := true;
    v_email_hash := encode(extensions.hmac(v_email_hash, v_secret, 'sha256'), 'hex');
    insert into private.customer_free_allowance_claims(identifier_type, identifier_hash, claimed_by_user_id)
    values ('email', v_email_hash, new.id) on conflict do nothing;
    select claimed_by_user_id into v_claimed_by
    from private.customer_free_allowance_claims
    where identifier_type = 'email' and identifier_hash = v_email_hash;
    if v_claimed_by is distinct from new.id then v_blocked := true; end if;
  end if;

  if v_phone_hash is not null and v_phone_hash <> '' then
    v_has_identifier := true;
    v_phone_hash := encode(extensions.hmac(v_phone_hash, v_secret, 'sha256'), 'hex');
    insert into private.customer_free_allowance_claims(identifier_type, identifier_hash, claimed_by_user_id)
    values ('phone', v_phone_hash, new.id) on conflict do nothing;
    select claimed_by_user_id into v_claimed_by
    from private.customer_free_allowance_claims
    where identifier_type = 'phone' and identifier_hash = v_phone_hash;
    if v_claimed_by is distinct from new.id then v_blocked := true; end if;
  end if;

  if not v_has_identifier or v_blocked then
    return new;
  end if;

  insert into public.customer_welcome_connection_grants(user_id)
  values (new.id) on conflict (user_id) do nothing;

  if found then
    insert into public.connection_credit_lots(user_id, source_type, total_connections, remaining_connections, expires_at)
    values (new.id, 'welcome', 1, 1, null) on conflict do nothing;

    insert into public.connection_wallets(user_id, balance)
    values (new.id, 1)
    on conflict (user_id) do update
      set balance = public.connection_wallets.balance + 1, updated_at = now();
  end if;

  return new;
end;
$function$;

-- Backfill every surviving successful welcome grant before the new rule takes effect.
insert into private.customer_free_allowance_claims(identifier_type, identifier_hash, claimed_by_user_id)
select distinct on (identifier_type, identifier_hash)
  identifier_type, identifier_hash, user_id
from (
  select
    'email'::text as identifier_type,
    encode(extensions.hmac(lower(btrim(u.email)), s.decrypted_secret, 'sha256'), 'hex') as identifier_hash,
    g.user_id,
    g.granted_at
  from public.customer_welcome_connection_grants g
  join auth.users u on u.id = g.user_id
  cross join lateral (
    select decrypted_secret from vault.decrypted_secrets
    where name = 'kampro_free_allowance_hmac_key' limit 1
  ) s
  where u.email is not null and u.email_confirmed_at is not null

  union all

  select
    'phone'::text,
    encode(extensions.hmac(regexp_replace(u.phone, '[^0-9+]', '', 'g'), s.decrypted_secret, 'sha256'), 'hex'),
    g.user_id,
    g.granted_at
  from public.customer_welcome_connection_grants g
  join auth.users u on u.id = g.user_id
  cross join lateral (
    select decrypted_secret from vault.decrypted_secrets
    where name = 'kampro_free_allowance_hmac_key' limit 1
  ) s
  where u.phone is not null and u.phone_confirmed_at is not null
) existing_claims
order by identifier_type, identifier_hash, granted_at
on conflict do nothing;
