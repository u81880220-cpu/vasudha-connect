insert into public.app_settings(key,value,description,is_public) values
('marketplace_default_radius_km','25'::jsonb,'Default search radius for map marketplace discovery.',true),
('marketplace_min_rating','0'::jsonb,'Minimum professional rating used by marketplace filtering.',true),
('marketplace_max_results','50'::jsonb,'Maximum professionals returned to a marketplace search.',true),
('marketplace_distance_weight','0.45'::jsonb,'Ranking weight for distance.',false),
('marketplace_rating_weight','0.25'::jsonb,'Ranking weight for professional rating.',false),
('marketplace_trust_weight','0.20'::jsonb,'Ranking weight for professional trust score.',false),
('marketplace_availability_weight','0.10'::jsonb,'Ranking weight for professional availability.',false)
on conflict (key) do nothing;
insert into public.feature_flags(key,enabled,description) values
('marketplace_verified_only',false,'When enabled, marketplace results include only verified professionals.'),
('marketplace_featured_enabled',false,'Enable future featured-professional ranking/placement.')
on conflict (key) do nothing;
