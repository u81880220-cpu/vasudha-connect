-- KAMPRO connection lifecycle: connection/chat ends on customer confirmation,
-- cancellation, or 24 hours after job creation, whichever occurs first.

create or replace function public.apply_job_connection_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null or new.professional_id is null then
    return new;
  end if;

  if new.status::text in ('customer_confirmed','cancelled') then
    update public.professional_connections
       set expires_at = now(),
           last_accessed_at = now()
     where customer_id = new.customer_id
       and professional_id = new.professional_id;
  elsif tg_op = 'INSERT' then
    update public.professional_connections
       set expires_at = new.created_at + interval '24 hours'
     where customer_id = new.customer_id
       and professional_id = new.professional_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_job_connection_expiry on public.jobs;
create trigger trg_job_connection_expiry
after insert or update of status on public.jobs
for each row execute function public.apply_job_connection_expiry();

-- Apply the same rule to jobs that already exist.
update public.professional_connections pc
   set expires_at = j.created_at + interval '24 hours'
  from public.jobs j
 where j.customer_id = pc.customer_id
   and j.professional_id = pc.professional_id
   and j.created_at >= pc.purchased_at
   and j.status::text not in ('customer_confirmed','cancelled');

update public.professional_connections pc
   set expires_at = now()
  from public.jobs j
 where j.customer_id = pc.customer_id
   and j.professional_id = pc.professional_id
   and j.created_at >= pc.purchased_at
   and j.status::text in ('customer_confirmed','cancelled');

-- Chat status uses the same authoritative connection/job expiry rule.
create or replace function public.get_conversation_chat_state(p_conversation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with c as (
  select id, customer_id, professional_id
  from public.conversations
  where id = p_conversation_id
    and (customer_id = auth.uid() or professional_id = auth.uid())
),
active_connection as (
  select pc.expires_at
  from public.professional_connections pc
  join c on c.customer_id = pc.customer_id and c.professional_id = pc.professional_id
  where pc.expires_at > now()
),
latest_job as (
  select j.status, j.created_at, j.completed_at
  from public.jobs j
  join c on c.customer_id = j.customer_id and c.professional_id = j.professional_id
  order by j.created_at desc
  limit 1
)
select case
  when not exists (select 1 from c) then
    jsonb_build_object('active', false, 'status', null, 'completed_at', null, 'reason', 'access_denied')
  when not exists (select 1 from active_connection) then
    jsonb_build_object('active', false, 'status', (select status::text from latest_job), 'completed_at', (select completed_at from latest_job), 'reason', 'connection_expired')
  when not exists (select 1 from latest_job) then
    jsonb_build_object('active', true, 'status', null, 'completed_at', null)
  when (select status::text from latest_job) in ('customer_confirmed', 'cancelled')
       or (select created_at from latest_job) + interval '24 hours' <= now() then
    jsonb_build_object('active', false, 'status', (select status::text from latest_job), 'completed_at', (select completed_at from latest_job), 'reason', 'job_window_ended')
  else
    jsonb_build_object('active', true, 'status', (select status::text from latest_job), 'completed_at', null)
end;
$function$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_message public.messages;
  v_state jsonb;
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.customer_id = auth.uid() or c.professional_id = auth.uid())
  ) then
    raise exception 'Conversation access denied';
  end if;

  v_state := public.get_conversation_chat_state(p_conversation_id);
  if coalesce((v_state->>'active')::boolean, false) = false then
    raise exception 'Chat is closed because the connection or job window has ended';
  end if;

  if nullif(trim(p_body), '') is null then
    raise exception 'Message cannot be empty';
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

grant execute on function public.get_conversation_chat_state(uuid) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
