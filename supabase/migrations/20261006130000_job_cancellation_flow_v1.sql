-- VASUDHA CONNECT: production-safe job cancellation flow.
-- Adds cancellation audit fields and a participant-authorized RPC.
-- Cancellation is allowed before work starts; once work starts, users should use the complaint/dispute flow.

alter table public.jobs
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz;

create or replace function public.cancel_job(
  p_job_id uuid,
  p_reason text default null
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  j public.jobs;
  other_user uuid;
  reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
    into j
  from public.jobs
  where id = p_job_id
    and (customer_id = auth.uid() or professional_id = auth.uid())
  for update;

  if j.id is null then
    raise exception 'Job not found or access denied';
  end if;

  if j.status not in (
    'quote_accepted'::job_status,
    'worker_accepted'::job_status,
    'on_the_way'::job_status,
    'arrived'::job_status
  ) then
    raise exception 'This job can no longer be cancelled. Please report a problem instead.';
  end if;

  reason := nullif(left(trim(coalesce(p_reason, '')), 500), '');

  update public.jobs
  set status = 'cancelled'::job_status,
      cancelled_by = auth.uid(),
      cancellation_reason = reason,
      cancelled_at = now(),
      updated_at = now()
  where id = p_job_id
  returning * into j;

  update public.service_requests
  set status = 'withdrawn'::quote_status,
      updated_at = now()
  where id = j.request_id
    and status in ('requested'::quote_status, 'accepted'::quote_status);

  update public.professional_profiles
  set is_available = true,
      updated_at = now()
  where user_id = j.professional_id;

  other_user := case
    when auth.uid() = j.customer_id then j.professional_id
    else j.customer_id
  end;

  perform public._create_notification_internal(
    other_user,
    'job',
    'Job cancelled',
    'A job has been cancelled by the other participant.',
    jsonb_build_object(
      'job_id', j.id,
      'status', j.status::text,
      'cancelled_by', auth.uid(),
      'reason', reason
    )
  );

  return j;
end;
$function$;

revoke all on function public.cancel_job(uuid,text) from public, anon;
grant execute on function public.cancel_job(uuid,text) to authenticated;
