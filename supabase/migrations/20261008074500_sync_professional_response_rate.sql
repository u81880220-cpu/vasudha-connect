-- Keep professional response rate synchronized with job requests.
create or replace function public.sync_professional_response_rate()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_responded integer;
begin
  if new.professional_id is null then return new; end if;
  select count(*) into v_total from public.service_requests where professional_id=new.professional_id;
  select count(*) into v_responded from public.service_requests where professional_id=new.professional_id and status in ('accepted','rejected');
  update public.professional_profiles
  set response_rate=case when v_total=0 then 0 else round((v_responded::numeric/v_total::numeric)*100,2) end,
      updated_at=now()
  where user_id=new.professional_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_professional_response_rate on public.service_requests;
create trigger trg_sync_professional_response_rate
after insert or update of status, professional_id on public.service_requests
for each row execute function public.sync_professional_response_rate();

update public.professional_profiles pp
set response_rate=case when x.total_requests=0 then 0 else round((x.responded_requests::numeric/x.total_requests::numeric)*100,2) end,
    updated_at=now()
from (
  select pp2.user_id,count(r.id) total_requests,
         count(r.id) filter (where r.status in ('accepted','rejected')) responded_requests
  from public.professional_profiles pp2
  left join public.service_requests r on r.professional_id=pp2.user_id
  group by pp2.user_id
) x
where pp.user_id=x.user_id;
