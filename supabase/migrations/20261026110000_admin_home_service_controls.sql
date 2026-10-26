-- Admin-controlled featured services on the KAMPRO customer home page.
alter table public.service_catalogue_services
  add column if not exists show_on_home boolean not null default true,
  add column if not exists home_display_order integer not null default 100;

create index if not exists service_catalogue_services_home_display_idx
  on public.service_catalogue_services (home_display_order, sort_order, name)
  where status = 'active' and show_on_home = true;

create or replace function public.admin_home_service_settings()
returns table(service_id uuid, show_on_home boolean, home_display_order integer)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Admin access required';
  end if;
  return query
    select s.id, s.show_on_home, s.home_display_order
    from public.service_catalogue_services s
    order by s.home_display_order, s.sort_order, s.name;
end;
$fn$;

revoke all on function public.admin_home_service_settings() from public, anon;
grant execute on function public.admin_home_service_settings() to authenticated;

create or replace function public.admin_set_home_service(
  p_service_id uuid,
  p_show_on_home boolean,
  p_home_display_order integer
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Admin access required';
  end if;
  if p_home_display_order is null or p_home_display_order < 1 then
    raise exception 'Home display order must be 1 or greater';
  end if;
  update public.service_catalogue_services
    set show_on_home = coalesce(p_show_on_home, false),
        home_display_order = p_home_display_order
    where id = p_service_id;
  if not found then
    raise exception 'Service not found';
  end if;
end;
$fn$;

revoke all on function public.admin_set_home_service(uuid, boolean, integer) from public, anon;
grant execute on function public.admin_set_home_service(uuid, boolean, integer) to authenticated;
