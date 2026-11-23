-- KAMPRO: either participant can complete the work; completion closes the shared chat.
-- Messages remain readable, while the send_message RPC rejects further messages.
-- The new job completion state is independent from the conversation chat_status.

alter table public.conversations
  add column if not exists chat_status text not null default 'active',
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id),
  add column if not exists close_reason text;

alter table public.conversations
  drop constraint if exists conversations_chat_status_check;
alter table public.conversations
  add constraint conversations_chat_status_check
  check (chat_status in ('active','closed'));

create or replace function public.get_conversation_chat_state(p_conversation_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $function$
  select case when c.id is null
    then jsonb_build_object('active',false,'status',null,'completed_at',null)
    else jsonb_build_object(
      'active', c.chat_status = 'active',
      'status', case when c.chat_status = 'closed' then coalesce(c.close_reason,'closed') else 'active' end,
      'completed_at', c.closed_at
    ) end
  from (select 1) seed
  left join public.conversations c
    on c.id = p_conversation_id
   and (c.customer_id = auth.uid() or c.professional_id = auth.uid());
$function$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages language plpgsql security definer set search_path = ''
as $function$
declare v_message public.messages;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.conversations c
    where c.id=p_conversation_id and (c.customer_id=auth.uid() or c.professional_id=auth.uid()))
    then raise exception 'Conversation access denied'; end if;
  if not exists (select 1 from public.conversations c
    where c.id=p_conversation_id and c.chat_status='active')
    then raise exception 'Chat is closed because the work has been marked completed'; end if;
  if nullif(trim(p_body),'') is null then raise exception 'Message cannot be empty'; end if;
  if char_length(trim(p_body)) > 5000 then raise exception 'Message is too long'; end if;
  insert into public.messages(conversation_id,sender_id,body)
    values(p_conversation_id,auth.uid(),trim(p_body)) returning * into v_message;
  update public.conversations set last_message_at=now(),updated_at=now() where id=p_conversation_id;
  return v_message;
end;
$function$;

create or replace function public.get_or_create_conversation(p_professional_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.professional_connections pc
    where pc.customer_id=auth.uid() and pc.professional_id=p_professional_id and pc.expires_at>now())
    then raise exception 'Active connection required'; end if;
  insert into public.conversations(customer_id,professional_id,chat_status,closed_at,closed_by,close_reason)
    values(auth.uid(),p_professional_id,'active',null,null,null)
  on conflict(customer_id,professional_id) do update
    set updated_at=now(),chat_status='active',closed_at=null,closed_by=null,close_reason=null
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.close_conversation_on_job_completion()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.status in ('work_completed','customer_confirmed') and old.status is distinct from new.status then
    update public.conversations c
      set chat_status='closed',closed_at=coalesce(new.completed_at,now()),
          closed_by=auth.uid(),close_reason='work_completed',updated_at=now()
    where c.customer_id=new.customer_id and c.professional_id=new.professional_id
      and c.chat_status <> 'closed';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_close_conversation_on_job_completion on public.jobs;
create trigger trg_close_conversation_on_job_completion
after update of status on public.jobs
for each row execute function public.close_conversation_on_job_completion();

create or replace function public.update_job_status(p_job_id uuid, p_status public.job_status)
returns public.jobs language plpgsql security definer set search_path = ''
as $function$
declare j public.jobs; v_actor uuid:=auth.uid(); allowed boolean:=false;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;
  select * into j from public.jobs where id=p_job_id
    and (customer_id=v_actor or professional_id=v_actor) for update;
  if j.id is null then raise exception 'Job not found or access denied'; end if;
  if p_status='work_completed' then
    if j.status='work_completed' then return j; end if;
    if j.status <> 'work_started' then raise exception 'Work can be marked completed only after it has started'; end if;
    update public.jobs set status='work_completed',completed_at=now(),updated_at=now()
      where id=p_job_id returning * into j;
    if v_actor=j.professional_id then
      update public.professional_profiles set is_available=true,updated_at=now() where user_id=j.professional_id;
    end if;
    return j;
  end if;
  if p_status='customer_confirmed' then
    raise exception 'Customer confirmation is no longer required. Either participant can mark work completed.';
  end if;
  if v_actor=j.professional_id then
    allowed := (j.status='worker_accepted' and p_status='on_the_way')
      or (j.status='on_the_way' and p_status='arrived')
      or (j.status='arrived' and p_status='work_started');
    if not allowed then raise exception 'Invalid job status transition'; end if;
  else
    raise exception 'Only the assigned professional can update this job status';
  end if;
  update public.jobs set status=p_status,updated_at=now() where id=p_job_id returning * into j;
  return j;
end;
$function$;

create or replace function public.notify_job_status_changed()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare label text;
begin
  if new.status is distinct from old.status then
    label:=replace(initcap(new.status::text),'_',' ');
    if new.status='work_completed' then
      perform public._create_notification_internal(new.customer_id,'job',
        'Work marked completed','The work has been marked completed. Your chat is now closed.',
        jsonb_build_object('job_id',new.id,'status',new.status::text,'chat_status','closed'));
      perform public._create_notification_internal(new.professional_id,'job',
        'Work marked completed','The work has been marked completed. Your chat is now closed.',
        jsonb_build_object('job_id',new.id,'status',new.status::text,'chat_status','closed'));
    else
      perform public._create_notification_internal(
        case when auth.uid()=new.customer_id then new.professional_id
             when auth.uid()=new.professional_id then new.customer_id else null end,
        'job','Job status updated','Job status is now '||label||'.',
        jsonb_build_object('job_id',new.id,'status',new.status::text));
    end if;
  end if;
  return new;
end;
$function$;

revoke update on public.conversations from authenticated;
grant select,insert on public.conversations to authenticated;
grant execute on function public.get_conversation_chat_state(uuid) to authenticated;
grant execute on function public.send_message(uuid,text) to authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;
grant execute on function public.update_job_status(uuid,public.job_status) to authenticated;
