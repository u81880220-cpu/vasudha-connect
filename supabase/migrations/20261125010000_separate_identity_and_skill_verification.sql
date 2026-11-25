alter table public.professional_profiles
  add column if not exists skill_verification_status public.verification_status not null default 'unverified'::public.verification_status;

create or replace function public.set_verification_pending_on_submission()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if lower(coalesce(new.document_type,'')) like 'skill:%' then
    update public.professional_profiles set skill_verification_status='pending'::public.verification_status,updated_at=now()
    where user_id=new.professional_id and skill_verification_status <> 'verified'::public.verification_status;
  else
    update public.professional_profiles set verification_status='pending'::public.verification_status,updated_at=now()
    where user_id=new.professional_id and verification_status <> 'verified'::public.verification_status;
  end if;
  return new;
end;
$function$;

create or replace function public.admin_pending_verifications()
returns table(document_id uuid,professional_id uuid,professional_name text,headline text,city text,state text,years_experience integer,document_type text,document_path text,submitted_at timestamptz)
language sql stable security definer set search_path to 'public'
as $function$
 select vd.id,vd.professional_id,coalesce(p.full_name,p.display_name,'Professional'),pp.headline,p.city,p.state,pp.years_experience,vd.document_type,vd.document_url,vd.submitted_at
 from public.verification_documents vd join public.professional_profiles pp on pp.user_id=vd.professional_id join public.profiles p on p.id=vd.professional_id
 where public.is_admin() and vd.status='pending'::public.verification_document_status order by vd.submitted_at asc
$function$;

create or replace function public.admin_review_verification(p_document_id uuid,p_decision public.verification_document_status,p_note text default null)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_professional uuid; v_document_type text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_decision not in ('approved'::public.verification_document_status,'rejected'::public.verification_document_status) then raise exception 'Decision must be approved or rejected'; end if;
 select professional_id,document_type into v_professional,v_document_type from public.verification_documents where id=p_document_id and status='pending'::public.verification_document_status for update;
 if v_professional is null then raise exception 'Pending verification document not found'; end if;
 update public.verification_documents set status=p_decision,reviewer_id=auth.uid(),reviewer_note=p_note,reviewed_at=now() where id=p_document_id;
 if lower(coalesce(v_document_type,'')) like 'skill:%' then
  update public.professional_profiles set skill_verification_status=case when p_decision='approved'::public.verification_document_status then 'verified'::public.verification_status else 'rejected'::public.verification_status end,updated_at=now() where user_id=v_professional;
 else
  update public.professional_profiles set verification_status=case when p_decision='approved'::public.verification_document_status then 'verified'::public.verification_status else 'rejected'::public.verification_status end,updated_at=now() where user_id=v_professional;
 end if;
 return true;
end;
$function$;

create or replace function public.get_professional_public_profile(p_professional_id uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
select jsonb_build_object(
 'profile',jsonb_build_object(
  'id',p.user_id,'display_name',coalesce(pr.display_name,pr.full_name,'KAMPRO Professional'),'avatar_url',pr.avatar_url,
  'city',coalesce((select nullif(trim(sa.city),'') from public.service_areas sa where sa.professional_id=p.user_id order by sa.is_primary desc,sa.created_at asc limit 1),pr.city),
  'state',coalesce((select nullif(trim(sa.state),'') from public.service_areas sa where sa.professional_id=p.user_id order by sa.is_primary desc,sa.created_at asc limit 1),pr.state),
  'headline',p.headline,'about',case when exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then p.about else null end,
  'years_experience',p.years_experience,'trust_score',p.trust_score,'verification_status',p.verification_status,'skill_verification_status',p.skill_verification_status,'is_available',p.is_available,
  'service_radius_km',case when exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then p.service_radius_km else null end,
  'connected',exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()),
  'phone',case when exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then (select phone from public.user_contact_details where user_id=p.user_id) else null end,
  'phone_2',case when exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then (select phone_2 from public.user_contact_details where user_id=p.user_id) else null end),
 'skills',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'category',s.category) order by ps.is_primary desc,s.name) from public.professional_skills ps join public.skills s on s.id=ps.skill_id where ps.professional_id=p.user_id and s.is_active),'[]'::jsonb),
 'sub_services',coalesce((select jsonb_agg(jsonb_build_object('id',ss.id,'name',ss.name,'service_id',svc.id,'service_name',svc.name,'category_id',cat.id,'category_name',cat.name) order by pss.is_primary desc,cat.name,svc.name,ss.name) from public.professional_sub_services pss join public.service_catalogue_sub_services ss on ss.id=pss.sub_service_id and ss.status='active' join public.service_catalogue_services svc on svc.id=ss.service_id and svc.status='active' join public.service_categories cat on cat.id=svc.category_id and cat.status='active' where pss.professional_id=p.user_id),'[]'::jsonb),
 'portfolio',coalesce((select jsonb_agg(jsonb_build_object('id',pi.id,'title',pi.title,'description',pi.description,'media_url',pi.media_url,'job_id',pi.job_id) order by pi.created_at desc) from public.portfolio_items pi where pi.professional_id=p.user_id and pi.moderation_status='approved'),'[]'::jsonb))
from public.professional_profiles p join public.profiles pr on pr.id=p.user_id where p.user_id=p_professional_id;
$function$;

grant execute on function public.admin_pending_verifications() to authenticated;
grant execute on function public.admin_review_verification(uuid,public.verification_document_status,text) to authenticated;
grant execute on function public.get_professional_public_profile(uuid) to authenticated;
