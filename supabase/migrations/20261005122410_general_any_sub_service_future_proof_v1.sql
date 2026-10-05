-- Future-proof service catalogue: every new main service gets a catch-all sub-service.
create or replace function public.ensure_general_any_sub_service()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.service_catalogue_sub_services
    (service_id,name,slug,description,status,sort_order)
  values
    (new.id,'General / Any','general-any','General service coverage for any work within this service.','active',0)
  on conflict (service_id,slug) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_service_catalogue_general_any on public.service_catalogue_services;
create trigger trg_service_catalogue_general_any
after insert on public.service_catalogue_services
for each row execute function public.ensure_general_any_sub_service();

create unique index if not exists ux_service_catalogue_sub_services_service_slug
on public.service_catalogue_sub_services(service_id,slug);

update public.service_catalogue_sub_services set sort_order=0 where lower(name)='general / any';
update public.service_catalogue_sub_services s set sort_order=greatest(coalesce(s.sort_order,1),1) where lower(s.name)<>'general / any';
grant execute on function public.ensure_general_any_sub_service() to authenticated;