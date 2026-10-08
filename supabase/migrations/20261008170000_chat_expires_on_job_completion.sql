-- KAMPRO: chat access ends when the latest job between the participants is completed.
-- 2026-10-08

create or replace function public.get_conversation_chat_state(p_conversation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
with c as (
  select id, customer_id, professional_id
  from public.conversations
  where id=p_conversation_id
    and (customer_id=auth.uid() or professional_id=auth.uid())
),
latest_job as (
  select j.status, j.completed_at
  from public.jobs j
  join c on c.customer_id=j.customer_id and c.professional_id=j.professional_id
  order by j.created_at desc
  limit 1
)
select case
  when not exists (select 1 from c) then
    jsonb_build_object('active',false,'status',null,'completed_at',null)
  when not exists (select 1 from latest_job) then
    jsonb_build_object('active',true,'status',null,'completed_at',null)
  when (select status from latest_job) in ('quote_accepted','worker_accepted','on_the_way','arrived','work_started') then
    jsonb_build_object('active',true,'status',(select status from latest_job),'completed_at',null)
  else
    jsonb_build_object('active',false,'status',(select status from latest_job),'completed_at',(select completed_at from latest_job))
end;
$function$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_message public.messages;
  v_state jsonb;
begin
  if not exists (
    select 1 from public.conversations c
    where c.id=p_conversation_id
      and (c.customer_id=auth.uid() or c.professional_id=auth.uid())
  ) then
    raise exception 'Conversation access denied';
  end if;

  v_state := public.get_conversation_chat_state(p_conversation_id);
  if coalesce((v_state->>'active')::boolean,false)=false then
    raise exception 'Chat is closed because the associated job is completed';
  end if;

  if nullif(trim(p_body),'') is null then
    raise exception 'Message cannot be empty';
  end if;

  insert into public.messages(conversation_id,sender_id,body)
  values(p_conversation_id,auth.uid(),trim(p_body))
  returning * into v_message;

  update public.conversations
  set last_message_at=now(),updated_at=now()
  where id=p_conversation_id;

  return v_message;
end;
$function$;

grant execute on function public.get_conversation_chat_state(uuid) to authenticated;
grant execute on function public.send_message(uuid,text) to authenticated;
