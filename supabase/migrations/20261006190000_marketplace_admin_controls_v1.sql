insert into public.app_settings(key,value,description,is_public) values
('marketplace_verified_only_default','true'::jsonb,'Default marketplace verified filter',true),
('marketplace_available_only_default','true'::jsonb,'Default marketplace availability filter',true),
('marketplace_max_radius_km','50'::jsonb,'Maximum marketplace radius in km',true),
('marketplace_trust_weight','0.5'::jsonb,'Marketplace trust ranking weight',true),
('marketplace_distance_weight','0.3'::jsonb,'Marketplace distance ranking weight',true),
('marketplace_availability_weight','0.2'::jsonb,'Marketplace availability ranking weight',true)
on conflict(key) do nothing;

create or replace function public.marketplace_configuration()
returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object(
 'default_radius_km',coalesce((select value::numeric from public.app_settings where key='marketplace_default_radius_km'),25),
 'max_radius_km',coalesce((select value::numeric from public.app_settings where key='marketplace_max_radius_km'),50),
 'verified_only_default',coalesce((select value::boolean from public.app_settings where key='marketplace_verified_only_default'),true),
 'available_only_default',coalesce((select value::boolean from public.app_settings where key='marketplace_available_only_default'),true),
 'min_rating',coalesce((select value::numeric from public.app_settings where key='marketplace_min_rating'),0),
 'trust_weight',coalesce((select value::numeric from public.app_settings where key='marketplace_trust_weight'),0.5),
 'distance_weight',coalesce((select value::numeric from public.app_settings where key='marketplace_distance_weight'),0.3),
 'availability_weight',coalesce((select value::numeric from public.app_settings where key='marketplace_availability_weight'),0.2)
);
$$;
revoke all on function public.marketplace_configuration() from public,anon;
grant execute on function public.marketplace_configuration() to authenticated;