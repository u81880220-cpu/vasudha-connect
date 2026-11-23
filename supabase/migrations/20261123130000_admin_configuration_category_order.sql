create or replace function public.admin_configuration()
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
select jsonb_build_object(
 'settings',(select coalesce(jsonb_agg(to_jsonb(x) order by x.key),'[]'::jsonb) from public.app_settings x where public.is_admin()),
 'flags',(select coalesce(jsonb_agg(to_jsonb(x) order by x.key),'[]'::jsonb) from public.feature_flags x where public.is_admin()),
 'locations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.city,x.name),'[]'::jsonb) from public.service_locations x where public.is_admin()),
 'packages',(select coalesce(jsonb_agg(to_jsonb(x) order by x.price_inr),'[]'::jsonb) from public.connection_packages x where public.is_admin()),
 'categories',(select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order,x.name),'[]'::jsonb) from public.service_categories x where public.is_admin())
);
$function$;
