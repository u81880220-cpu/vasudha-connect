-- Catalogue category/service filters must not also require a legacy skill assignment.
-- New professionals are assigned through professional_sub_services; legacy_skill_id
-- is an optional compatibility mapping and is not proof of a professional_skills row.
create or replace function public.nearby_professionals_map(
  p_latitude numeric,
  p_longitude numeric,
  p_radius_km numeric,
  p_skill_id uuid,
  p_sub_service_id uuid,
  p_category_id uuid,
  p_service_id uuid
)
returns table(
  professional_id uuid,
  display_name text,
  headline text,
  city text,
  state text,
  avatar_url text,
  trust_score numeric,
  verification_status public.verification_status,
  is_available boolean,
  distance_km numeric,
  latitude numeric,
  longitude numeric,
  skills jsonb,
  profile_completion numeric
)
language sql
stable
security definer
set search_path = public
as $function$
  select n.*
  from public.nearby_professionals_map(
    p_latitude,
    p_longitude,
    p_radius_km,
    case
      when p_category_id is not null or p_service_id is not null then null
      else p_skill_id
    end,
    p_sub_service_id
  ) as n
  where
    (p_category_id is null or exists (
      select 1
      from public.service_catalogue_services scs
      where scs.category_id = p_category_id
        and scs.status = 'active'
        and (
          (scs.legacy_skill_id is not null and exists (
            select 1 from public.professional_skills ps
            where ps.professional_id = n.professional_id
              and ps.skill_id = scs.legacy_skill_id
          ))
          or exists (
            select 1
            from public.professional_sub_services pss
            join public.service_catalogue_sub_services scsub on scsub.id = pss.sub_service_id
            where pss.professional_id = n.professional_id
              and scsub.service_id = scs.id
              and scsub.status = 'active'
          )
        )
    ))
    and (p_service_id is null or exists (
      select 1
      from public.service_catalogue_services scs
      where scs.id = p_service_id
        and scs.status = 'active'
        and (
          (scs.legacy_skill_id is not null and exists (
            select 1 from public.professional_skills ps
            where ps.professional_id = n.professional_id
              and ps.skill_id = scs.legacy_skill_id
          ))
          or exists (
            select 1
            from public.professional_sub_services pss
            join public.service_catalogue_sub_services scsub on scsub.id = pss.sub_service_id
            where pss.professional_id = n.professional_id
              and scsub.service_id = scs.id
              and scsub.status = 'active'
          )
        )
    ));
$function$;
