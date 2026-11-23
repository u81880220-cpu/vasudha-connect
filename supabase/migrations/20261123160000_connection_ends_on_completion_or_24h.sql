-- KAMPRO connection lifecycle:
-- A job's connection expires 24 hours after job creation unless work is
-- marked completed earlier, in which case access ends immediately.

create or replace function public.set_professional_connection_job_start_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.professional_connections c
     set expires_at = new.created_at + interval '24 hours'
   where c.customer_id = new.customer_id
     and c.professional_id = new.professional_id;
  return new;
end;
$function$;

drop trigger if exists trg_set_professional_connection_completion_grace on public.jobs;

create or replace function public.revoke_professional_connection_after_job_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status in ('work_completed'::public.job_status, 'customer_confirmed'::public.job_status)
     and old.status is distinct from new.status then
    update public.professional_connections c
       set expires_at = now()
     where c.customer_id = new.customer_id
       and c.professional_id = new.professional_id;
  end if;
  return new;
end;
$function$;

create or replace function public.get_conversation_chat_state(p_conversation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
with conversation_row as (
  select c.id, c.customer_id, c.professional_id, c.chat_status, c.close_reason, c.closed_at
  from public.conversations c
  where c.id = p_conversation_id
    and (c.customer_id = auth.uid() or c.professional_id = auth.uid())
),
latest_job as (
  select j.status, j.created_at, j.completed_at
  from public.jobs j
  join conversation_row c
    on c.customer_id = j.customer_id
   and c.professional_id = j.professional_id
  order by j.created_at desc
  limit 1
)
select case
  when not exists (select 1 from conversation_row) then
    jsonb_build_object('active', false, 'status', 'not_found', 'completed_at', null)
  when exists (
    select 1 from latest_job
    where status in ('work_completed'::public.job_status,
                     'customer_confirmed'::public.job_status,
                     'cancelled'::public.job_status,
                     'disputed'::public.job_status)
  ) then
    jsonb_build_object(
      'active', false,
      'status', (select status::text from latest_job),
      'completed_at', (select completed_at from latest_job)
    )
  when exists (
    select 1 from latest_job
    where created_at <= now() - interval '24 hours'
  ) then
    jsonb_build_object('active', false, 'status', 'expired_24h', 'completed_at', null)
  when (select chat_status from conversation_row) = 'closed' then
    jsonb_build_object(
      'active', false,
      'status', coalesce((select close_reason from conversation_row), 'closed'),
      'completed_at', (select closed_at from conversation_row)
    )
  else
    jsonb_build_object(
      'active', true,
      'status', coalesce((select status::text from latest_job), 'no_job'),
      'completed_at', null
    )
end;
$function$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_message public.messages;
  v_state jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.customer_id = auth.uid() or c.professional_id = auth.uid())
  ) then
    raise exception 'Conversation access denied';
  end if;

  v_state := public.get_conversation_chat_state(p_conversation_id);
  if coalesce((v_state->>'active')::boolean, false) = false then
    raise exception 'Chat is closed: work completed or 24-hour connection window expired';
  end if;

  if nullif(trim(p_body), '') is null then
    raise exception 'Message cannot be empty';
  end if;
  if char_length(trim(p_body)) > 5000 then
    raise exception 'Message is too long';
  end if;

  insert into public.messages(conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), trim(p_body))
  returning * into v_message;

  update public.conversations
     set last_message_at = now(), updated_at = now()
   where id = p_conversation_id;

  return v_message;
end;
$function$;

revoke all on function public.get_conversation_chat_state(uuid) from public, anon;
grant execute on function public.get_conversation_chat_state(uuid) to authenticated;
revoke all on function public.send_message(uuid,text) from public, anon;
grant execute on function public.send_message(uuid,text) to authenticated;
