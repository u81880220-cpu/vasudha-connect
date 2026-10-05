-- Expose approved dynamic sub-services on a professional public profile.
create or replace function public.get_professional_public_profile(p_professional_id uuid)
returns jsonb
language sql stable security definer set search_path=public
as $function$
select jsonb_build_object(
 'profile',jsonb_build_object(
  'id',p.user_id,'display_name',coalesce(pr.display_name,pr.full_name,'VASUDHA Professional'),
  'avatar_url',pr.avatar_url,'city',pr.city,'state',pr.state,'headline',p.headline,
  'about',case when exists(select 1 from professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then p.about else null end,
  'years_experience',p.years_experience,'trust_score',p.trust_score,'verification_status',p.verification_status,'is_available',p.is_available,
  'service_radius_km',case when exists(select 1 from professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then p.service_radius_km else null end,
  'connected',exists(select 1 from professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()),
  'phone',case when exists(select 1 from professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then (select phone from user_contact_details where user_id=p.user_id) else null end
 ),
 'skills',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'category',s.category) order by ps.is_primary desc,s.name) from professional_skills ps join skills s on s.id=ps.skill_id where ps.professional_id=p.user_id and s.is_active),'[]'::jsonb),
 'sub_services',coalesce((select jsonb_agg(jsonb_build_object('id',ss.id,'name',ss.name,'service_id',svc.id,'service_name',svc.name,'category_id',cat.id,'category_name',cat.name) order by pss.is_primary desc,cat.name,svc.name,ss.name)
   from professional_sub_services pss
   join service_catalogue_sub_services ss on ss.id=pss.sub_service_id and ss.status='active'
   join service_catalogue_services svc on svc.id=ss.service_id and svc.status='active'
   join service_categories cat on cat.id=svc.category_id and cat.status='active'
   where pss.professional_id=p.user_id),'[]'::jsonb),
 'portfolio',case when exists(select 1 from professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now())
  then coalesce((select jsonb_agg(jsonb_build_object('id',pi.id,'title',pi.title,'description',pi.description,'media_url',pi.media_url) order by pi.created_at desc) from portfolio_items pi where pi.professional_id=p.user_id and pi.moderation_status='approved'),'[]'::jsonb)
  else '[]'::jsonb end
)
from professional_profiles p join profiles pr on pr.id=p.user_id
where p.user_id=p_professional_id and p.verification_status='verified';
$function$;