-- Freeze the no-quotation business model at the database boundary.
-- Keep the legacy quotes table for historical safety, but make it inaccessible
-- and remove quotation execution/notification paths.

drop policy if exists "professionals submit quotes" on public.quotes;
drop policy if exists "quote participants read" on public.quotes;

revoke all on table public.quotes from anon, authenticated;

drop trigger if exists trg_notify_quote_submitted on public.quotes;
drop trigger if exists trg_notify_quote_accepted on public.quotes;

revoke all on function public.accept_quote(uuid) from public, anon, authenticated;
revoke all on function public.create_job_from_quote(uuid) from public, anon, authenticated;
revoke all on function public.notify_quote_accepted() from public, anon, authenticated;
revoke all on function public.notify_quote_submitted() from public, anon, authenticated;

create or replace function public.admin_work_360(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_job_id is null then raise exception 'Job is required'; end if;

  select jsonb_build_object(
    'job',(select to_jsonb(j) from public.jobs j where j.id=p_job_id),
    'customer',(
      select jsonb_build_object('id',p.id,'name',coalesce(p.display_name,p.full_name,'Customer'),'city',p.city,'state',p.state)
      from public.jobs j join public.profiles p on p.id=j.customer_id where j.id=p_job_id
    ),
    'professional',(
      select jsonb_build_object('id',p.id,'name',coalesce(p.display_name,p.full_name,'Professional'),'city',p.city,'state',p.state)
      from public.jobs j join public.profiles p on p.id=j.professional_id where j.id=p_job_id
    ),
    'request',(
      select to_jsonb(r) from public.service_requests r
      join public.jobs j on j.request_id=r.id where j.id=p_job_id
    ),
    'review',(
      select to_jsonb(r) from public.job_reviews r where r.job_id=p_job_id
    ),
    'cancellation',(
      select jsonb_build_object('cancelled_by',j.cancelled_by,'reason',j.cancellation_reason,'cancelled_at',j.cancelled_at)
      from public.jobs j where j.id=p_job_id and j.cancelled_at is not null
    )
  ) into v_result;

  if v_result->'job' is null then raise exception 'Job not found'; end if;
  return v_result;
end;
$function$;

revoke all on function public.admin_work_360(uuid) from public, anon, authenticated;
grant execute on function public.admin_work_360(uuid) to authenticated;
