-- KAMPRO: identify which participant marked work completed in both notifications.
-- Existing completion/chat lifecycle migrations are already deployed.
create or replace function public.notify_job_status_changed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  label text;
  recipient uuid;
  actor_label text;
  completion_message text;
begin
  if new.status is distinct from old.status then
    label := replace(initcap(new.status::text), '_', ' ');
    if new.status = 'work_completed' then
      actor_label := case
        when auth.uid() = new.customer_id then 'The customer'
        when auth.uid() = new.professional_id then 'The professional'
        else 'A participant'
      end;
      completion_message := actor_label || ' marked this work as completed. Your chat is now closed.';
      perform public._create_notification_internal(
        new.customer_id, 'job', 'Work marked completed', completion_message,
        jsonb_build_object('job_id',new.id,'status',new.status::text,'chat_status','closed','completed_by',auth.uid())
      );
      perform public._create_notification_internal(
        new.professional_id, 'job', 'Work marked completed', completion_message,
        jsonb_build_object('job_id',new.id,'status',new.status::text,'chat_status','closed','completed_by',auth.uid())
      );
    else
      recipient := case
        when auth.uid() = new.customer_id then new.professional_id
        when auth.uid() = new.professional_id then new.customer_id
        else null
      end;
      if recipient is not null then
        perform public._create_notification_internal(
          recipient,'job','Job status updated','Job status is now ' || label || '.',
          jsonb_build_object('job_id',new.id,'status',new.status::text)
        );
      end if;
    end if;
  end if;
  return new;
end;
$function$;
