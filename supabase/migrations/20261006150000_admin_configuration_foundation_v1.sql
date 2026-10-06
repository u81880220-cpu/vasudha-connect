create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.service_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state text,
  country text not null default 'India',
  latitude numeric,
  longitude numeric,
  radius_km numeric not null default 25,
  status text not null default 'inactive' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(city,state,country)
);

alter table public.app_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.service_locations enable row level security;

create or replace function public.admin_configuration()
returns jsonb
language sql
security definer
set search_path=public
as $$
select jsonb_build_object(
 'settings',(select coalesce(jsonb_agg(to_jsonb(x) order by x.key),'[]'::jsonb) from public.app_settings x where public.is_admin()),
 'flags',(select coalesce(jsonb_agg(to_jsonb(x) order by x.key),'[]'::jsonb) from public.feature_flags x where public.is_admin()),
 'locations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.city,x.name),'[]'::jsonb) from public.service_locations x where public.is_admin()),
 'packages',(select coalesce(jsonb_agg(to_jsonb(x) order by x.price_inr),'[]'::jsonb) from public.connection_packages x where public.is_admin())
);
$$;
revoke all on function public.admin_configuration() from public,anon,authenticated;
grant execute on function public.admin_configuration() to authenticated;

create or replace function public.admin_upsert_app_setting(
 p_key text,p_value jsonb,p_description text default null,p_is_public boolean default false
)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if coalesce(trim(p_key),'')='' then raise exception 'Setting key is required'; end if;
 insert into public.app_settings(key,value,description,is_public,updated_at,updated_by)
 values(trim(p_key),coalesce(p_value,'{}'::jsonb),nullif(trim(p_description),''),p_is_public,now(),auth.uid())
 on conflict(key) do update set value=excluded.value,description=excluded.description,is_public=excluded.is_public,updated_at=now(),updated_by=auth.uid();
end $$;
revoke all on function public.admin_upsert_app_setting(text,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_upsert_app_setting(text,jsonb,text,boolean) to authenticated;

create or replace function public.admin_set_feature_flag(
 p_key text,p_enabled boolean,p_description text default null
)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if coalesce(trim(p_key),'')='' then raise exception 'Feature key is required'; end if;
 insert into public.feature_flags(key,enabled,description,updated_at,updated_by)
 values(trim(p_key),p_enabled,nullif(trim(p_description),''),now(),auth.uid())
 on conflict(key) do update set enabled=excluded.enabled,description=coalesce(excluded.description,feature_flags.description),updated_at=now(),updated_by=auth.uid();
end $$;
revoke all on function public.admin_set_feature_flag(text,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_set_feature_flag(text,boolean,text) to authenticated;

create or replace function public.admin_save_service_location(
 p_action text,p_id uuid default null,p_name text default null,p_city text default null,p_state text default null,
 p_country text default 'India',p_latitude numeric default null,p_longitude numeric default null,
 p_radius_km numeric default 25,p_status text default 'inactive'
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_action not in ('create','update','delete') then raise exception 'Invalid location action'; end if;
 if p_action='delete' then
   delete from public.service_locations where id=p_id returning id into v_id;
   if v_id is null then raise exception 'Location not found'; end if;
   return v_id;
 end if;
 if coalesce(trim(p_name),'')='' or coalesce(trim(p_city),'')='' then raise exception 'Location name and city are required'; end if;
 if p_radius_km<=0 or p_radius_km>500 then raise exception 'Radius must be between 0 and 500 km'; end if;
 if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then raise exception 'Invalid latitude'; end if;
 if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then raise exception 'Invalid longitude'; end if;
 if p_status not in ('active','inactive') then raise exception 'Invalid location status'; end if;
 if p_action='create' then
   insert into public.service_locations(name,city,state,country,latitude,longitude,radius_km,status)
   values(trim(p_name),trim(p_city),nullif(trim(p_state),''),coalesce(nullif(trim(p_country),''),'India'),p_latitude,p_longitude,p_radius_km,p_status)
   returning id into v_id;
 else
   update public.service_locations set name=trim(p_name),city=trim(p_city),state=nullif(trim(p_state),''),
     country=coalesce(nullif(trim(p_country),''),'India'),latitude=p_latitude,longitude=p_longitude,
     radius_km=p_radius_km,status=p_status,updated_at=now() where id=p_id returning id into v_id;
   if v_id is null then raise exception 'Location not found'; end if;
 end if;
 return v_id;
end $$;
revoke all on function public.admin_save_service_location(text,uuid,text,text,text,text,numeric,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.admin_save_service_location(text,uuid,text,text,text,text,numeric,numeric,numeric,text) to authenticated;

create or replace function public.admin_set_connection_package(
 p_code connection_package_code,p_price_inr numeric,p_connections integer,p_validity_days integer,p_active boolean
)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_price_inr<0 or p_connections<=0 or p_validity_days<=0 then raise exception 'Invalid package values'; end if;
 update public.connection_packages set price_inr=p_price_inr,connections=p_connections,validity_days=p_validity_days,is_active=p_active where code=p_code;
 if not found then raise exception 'Package not found'; end if;
end $$;
revoke all on function public.admin_set_connection_package(connection_package_code,numeric,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.admin_set_connection_package(connection_package_code,numeric,integer,integer,boolean) to authenticated;

insert into public.feature_flags(key,enabled,description)
values
 ('marketplace_enabled',true,'Enable professional marketplace'),
 ('connections_enabled',true,'Enable customer-professional connections'),
 ('chat_enabled',true,'Enable in-app chat'),
 ('service_requests_enabled',true,'Enable service requests'),
 ('reviews_enabled',true,'Enable reviews'),
 ('payments_enabled',true,'Enable connection payments')
on conflict(key) do nothing;

insert into public.app_settings(key,value,description,is_public)
values
 ('marketplace_default_radius_km','25'::jsonb,'Default marketplace search radius',false),
 ('marketplace_min_rating','0'::jsonb,'Minimum professional rating filter',false),
 ('connection_currency','"INR"'::jsonb,'Connection package currency',true)
on conflict(key) do nothing;
