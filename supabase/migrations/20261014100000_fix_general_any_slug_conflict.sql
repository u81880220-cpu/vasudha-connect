-- Fix admin service approval: general-any must have a globally unique slug per service.
-- service_catalogue_sub_services.slug is globally unique, so the literal 'general-any'
-- collides as soon as a second service is added. Keep the existing unique constraint
-- and generate a deterministic service-specific slug instead.

create or replace function public.ensure_general_any_sub_service()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  v_slug := trim(both '-' from regexp_replace(
    lower(coalesce(new.slug, 'service') || '-general-any'),
    '[^a-z0-9]+',
    '-',
    'g'
  ));

  insert into public.service_catalogue_sub_services
    (service_id, name, slug, description, status, sort_order)
  values
    (new.id, 'General / Any', v_slug,
     'General service coverage for any work within this service.',
     'active', 0)
  on conflict (slug) do nothing;

  return new;
end;
$$;

-- Recreate explicitly to ensure new service rows use the corrected function.
drop trigger if exists trg_service_catalogue_general_any on public.service_catalogue_services;
create trigger trg_service_catalogue_general_any
after insert on public.service_catalogue_services
for each row execute function public.ensure_general_any_sub_service();
