create or replace function public.marketplace_configuration()
returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object(
 'default_radius_km',coalesce((select value::numeric from public.app_settings where key='marketplace_default_radius_km'),25),
 'max_radius_km',coalesce((select value::numeric from public.app_settings where key='marketplace_max_radius_km'),50),
 'max_results',coalesce((select value::integer from public.app_settings where key='marketplace_max_results'),50),
 'verified_only_default',coalesce((select value::boolean from public.app_settings where key='marketplace_verified_only_default'),true),
 'available_only_default',coalesce((select value::boolean from public.app_settings where key='marketplace_available_only_default'),true),
 'min_rating',coalesce((select value::numeric from public.app_settings where key='marketplace_min_rating'),0),
 'trust_weight',coalesce((select value::numeric from public.app_settings where key='marketplace_trust_weight'),0.2),
 'distance_weight',coalesce((select value::numeric from public.app_settings where key='marketplace_distance_weight'),0.45),
 'availability_weight',coalesce((select value::numeric from public.app_settings where key='marketplace_availability_weight'),0.1),
 'rating_weight',coalesce((select value::numeric from public.app_settings where key='marketplace_rating_weight'),0.25)
); $$;
