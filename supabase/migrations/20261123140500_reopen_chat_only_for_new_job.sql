-- Do not reopen a completed chat merely because a participant opens it.
-- Reopen only when a new job is created for the same pair of participants.
create or replace function public.get_or_create_conversation(p_professional_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.professional_connections pc
    where pc.customer_id=auth.uid() and pc.professional_id=p_professional_id and pc.expires_at>now())
    then raise exception 'Active connection required'; end if;
  insert into public.conversations(customer_id,professional_id)
    values(auth.uid(),p_professional_id)
  on conflict(customer_id,professional_id) do update set updated_at=now()
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.reopen_conversation_for_new_job()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  update public.conversations c
    set chat_status='active',closed_at=null,closed_by=null,close_reason=null,updated_at=now()
  where c.customer_id=new.customer_id and c.professional_id=new.professional_id;
  return new;
end;
$function$;

drop trigger if exists trg_reopen_conversation_for_new_job on public.jobs;
create trigger trg_reopen_conversation_for_new_job
after insert on public.jobs
for each row execute function public.reopen_conversation_for_new_job();

-- Preserve the existing guard for status changes made by trusted system processes.
create or replace function public.notify_job_status_changed()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare label text; recipient uuid;
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
      recipient:=case when auth.uid()=new.customer_id then new.professional_id
                      when auth.uid()=new.professional_id then new.customer_id else null end;
      if recipient is not null then
        perform public._create_notification_internal(recipient,'job','Job status updated',
          'Job status is now '||label||'.',jsonb_build_object('job_id',new.id,'status',new.status::text));
      end if;
    end if;
  end if;
  return new;
end;
$function$;