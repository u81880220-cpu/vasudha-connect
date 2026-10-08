-- Keep professional completion rate synchronized with completed jobs.
create or replace function public.sync_professional_completion_rate()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_completed integer;
begin
  if new.professional_id is null then return new; end if;
  select count(*) into v_total from public.jobs where professional_id=new.professional_id;
  select count(*) into v_completed from public.jobs where professional_id=new.professional_id and status='customer_confirmed';
  update public.professional_profiles
  set completion_rate = case when v_total=0 then 0 else round((v_completed::numeric / v_total::numeric) * 100, 2) end,
      updated_at=now()
  where user_id=new.professional_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_professional_completion_rate on public.jobs;
create trigger trg_sync_professional_completion_rate
after insert or update of status, professional_id on public.jobs
for each row execute function public.sync_professional_completion_rate();

update public.professional_profiles pp
set completion_rate = case when x.total_jobs=0 then 0 else round((x.completed_jobs::numeric / x.total_jobs::numeric) * 100, 2) end,
    updated_at=now()
from (
  select pp2.user_id, count(j.id) total_jobs,
         count(j.id) filter (where j.status='customer_confirmed') completed_jobs
  from public.professional_profiles pp2
  left join public.jobs j on j.professional_id=pp2.user_id
  group by pp2.user_id
) x
where pp.user_id=x.user_id;
