-- KAMPRO completed-work photo portfolio
alter table public.portfolio_items
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

create index if not exists portfolio_items_job_professional_idx
  on public.portfolio_items(job_id, professional_id)
  where job_id is not null;

create or replace function public.validate_completed_work_portfolio_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_job public.jobs%rowtype;
begin
  if new.job_id is null then
    return new;
  end if;

  select * into related_job
  from public.jobs
  where id = new.job_id;

  if not found
     or related_job.professional_id is distinct from new.professional_id
     or related_job.status::text not in ('work_completed', 'customer_confirmed') then
    raise exception 'Work photos can only be added by the assigned professional after work is completed.';
  end if;

  if (select count(*) from public.portfolio_items
      where job_id = new.job_id and professional_id = new.professional_id
        and id is distinct from new.id) >= 2 then
    raise exception 'A maximum of two photos is allowed per completed job.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_completed_work_portfolio_photo on public.portfolio_items;
create trigger validate_completed_work_portfolio_photo
before insert or update of job_id, professional_id on public.portfolio_items
for each row execute function public.validate_completed_work_portfolio_photo();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('professional-work-photos', 'professional-work-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists professional_work_photos_public_read on storage.objects;
create policy professional_work_photos_public_read
on storage.objects for select
using (bucket_id = 'professional-work-photos');

drop policy if exists professional_work_photos_owner_insert on storage.objects;
create policy professional_work_photos_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'professional-work-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists professional_work_photos_owner_delete on storage.objects;
create policy professional_work_photos_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'professional-work-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.get_professional_public_profile(p_professional_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
select jsonb_build_object(
 'profile',jsonb_build_object(
  'id',p.user_id,
  'display_name',coalesce(pr.display_name,pr.full_name,'KAMPRO Professional'),
  'avatar_url',pr.avatar_url,
  'city',coalesce((select nullif(trim(sa.city),'') from public.service_areas sa where sa.professional_id=p.user_id order by sa.is_primary desc,sa.created_at asc limit 1),pr.city),
  'state',coalesce((select nullif(trim(sa.state),'') from public.service_areas sa where sa.professional_id=p.user_id order by sa.is_primary desc,sa.created_at asc limit 1),pr.state),
  'headline',p.headline,
  'about',case when exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then p.about else null end,
  'years_experience',p.years_experience,
  'trust_score',p.trust_score,
  'verification_status',p.verification_status,
  'is_available',p.is_available,
  'service_radius_km',case when exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then p.service_radius_km else null end,
  'connected',exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()),
  'phone',case when exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then (select phone from public.user_contact_details where user_id=p.user_id) else null end,
  'phone_2',case when exists(select 1 from public.professional_connections c where c.customer_id=auth.uid() and c.professional_id=p.user_id and c.expires_at>now()) then (select phone_2 from public.user_contact_details where user_id=p.user_id) else null end
 ),
 'skills',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'category',s.category) order by ps.is_primary desc,s.name) from public.professional_skills ps join public.skills s on s.id=ps.skill_id where ps.professional_id=p.user_id and s.is_active),'[]'::jsonb),
 'sub_services',coalesce((select jsonb_agg(jsonb_build_object('id',ss.id,'name',ss.name,'service_id',svc.id,'service_name',svc.name,'category_id',cat.id,'category_name',cat.name) order by pss.is_primary desc,cat.name,svc.name,ss.name)
   from public.professional_sub_services pss
   join public.service_catalogue_sub_services ss on ss.id=pss.sub_service_id and ss.status='active'
   join public.service_catalogue_services svc on svc.id=ss.service_id and svc.status='active'
   join public.service_categories cat on cat.id=svc.category_id and cat.status='active'
   where pss.professional_id=p.user_id),'[]'::jsonb),
 'portfolio',coalesce((select jsonb_agg(jsonb_build_object('id',pi.id,'title',pi.title,'description',pi.description,'media_url',pi.media_url,'job_id',pi.job_id) order by pi.created_at desc)
   from public.portfolio_items pi where pi.professional_id=p.user_id and pi.moderation_status='approved'),'[]'::jsonb)
)
from public.professional_profiles p
join public.profiles pr on pr.id=p.user_id
where p.user_id=p_professional_id;
$function$;
