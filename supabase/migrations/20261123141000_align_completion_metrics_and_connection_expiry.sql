-- Keep completion metrics, professional availability and connection expiry aligned
-- with the new single-step work_completed final state.
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
    update public.professional_profiles set is_available=true,updated_at=now()
      where user_id=j.professional_id;
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

create or replace function public.sync_professional_completion_rate()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_total integer; v_completed integer;
begin
  if new.professional_id is null then return new; end if;
  select count(*) into v_total from public.jobs where professional_id=new.professional_id;
  select count(*) into v_completed from public.jobs
    where professional_id=new.professional_id and status in ('work_completed','customer_confirmed');
  update public.professional_profiles
    set completion_rate=case when v_total=0 then 0 else round((v_completed::numeric/v_total::numeric)*100,2) end,
        updated_at=now()
  where user_id=new.professional_id;
  return new;
end;
$function$;

create or replace function public.set_professional_connection_completion_grace()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.status='work_completed' and old.status is distinct from new.status then
    if not exists (
      select 1 from public.jobs j
      where j.customer_id=new.customer_id and j.professional_id=new.professional_id
        and j.id<>new.id
        and j.status not in ('work_completed','customer_confirmed','cancelled')
    ) then
      update public.professional_connections c
        set expires_at=now()+interval '24 hours'
      where c.customer_id=new.customer_id and c.professional_id=new.professional_id;
    end if;
  end if;
  return new;
end;
$function$;