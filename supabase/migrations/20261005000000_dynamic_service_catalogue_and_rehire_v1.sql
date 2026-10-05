-- Dynamic Category -> Service -> Sub-service catalogue and one-tap customer rehire
-- Applied to VASUDHA CONNECT production Supabase.

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  description text,
  status text not null default 'active' check (status in ('draft','active','inactive','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_catalogue_services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete restrict,
  legacy_skill_id uuid unique references public.skills(id) on delete set null,
  name text not null,
  slug text not null unique,
  icon text,
  description text,
  status text not null default 'active' check (status in ('draft','active','inactive','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id,name)
);

create table if not exists public.service_catalogue_sub_services (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_catalogue_services(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'active' check (status in ('draft','active','inactive','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_id,name)
);

create table if not exists public.professional_sub_services (
  professional_id uuid not null references auth.users(id) on delete cascade,
  sub_service_id uuid not null references public.service_catalogue_sub_services(id) on delete restrict,
  years_experience integer not null default 0 check (years_experience >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(professional_id,sub_service_id)
);

alter table public.service_requests
  add column if not exists service_id uuid references public.service_catalogue_services(id) on delete set null,
  add column if not exists sub_service_id uuid references public.service_catalogue_sub_services(id) on delete set null;

create index if not exists idx_service_catalogue_services_category on public.service_catalogue_services(category_id,status,sort_order);
create index if not exists idx_service_catalogue_sub_services_service on public.service_catalogue_sub_services(service_id,status,sort_order);
create index if not exists idx_professional_sub_services_sub_service on public.professional_sub_services(sub_service_id,professional_id);
create index if not exists idx_service_requests_sub_service on public.service_requests(sub_service_id);

alter table public.service_categories enable row level security;
alter table public.service_catalogue_services enable row level security;
alter table public.service_catalogue_sub_services enable row level security;
alter table public.professional_sub_services enable row level security;

drop policy if exists "active service categories are public" on public.service_categories;
create policy "active service categories are public" on public.service_categories
for select to authenticated using (status='active');

drop policy if exists "active catalogue services are public" on public.service_catalogue_services;
create policy "active catalogue services are public" on public.service_catalogue_services
for select to authenticated using (status='active');

drop policy if exists "active catalogue sub services are public" on public.service_catalogue_sub_services;
create policy "active catalogue sub services are public" on public.service_catalogue_sub_services
for select to authenticated using (status='active');

drop policy if exists "professionals manage own sub services" on public.professional_sub_services;
create policy "professionals manage own sub services" on public.professional_sub_services
for all to authenticated using (professional_id=auth.uid()) with check (professional_id=auth.uid());

do $$
declare rcat record; rskill record; cat_id uuid; svc_id uuid; sub_id uuid;
begin
  for rcat in select distinct category from public.skills where category is not null order by category loop
    insert into public.service_categories(name,slug,sort_order)
    values (rcat.category, lower(regexp_replace(rcat.category,'[^a-zA-Z0-9]+','-','g')), 0)
    on conflict(name) do update set updated_at=now()
    returning id into cat_id;
    for rskill in select id,name,description from public.skills where category=rcat.category loop
      insert into public.service_catalogue_services(category_id,legacy_skill_id,name,slug,description,sort_order)
      values (cat_id,rskill.id,rskill.name,lower(regexp_replace(rcat.category||'-'||rskill.name,'[^a-zA-Z0-9]+','-','g')),rskill.description,0)
      on conflict(legacy_skill_id) do update set category_id=excluded.category_id,name=excluded.name,description=excluded.description,updated_at=now()
      returning id into svc_id;
      insert into public.service_catalogue_sub_services(service_id,name,slug,description,sort_order)
      values(svc_id,'General / Any',lower(regexp_replace(rcat.category||'-'||rskill.name||'-general','[^a-zA-Z0-9]+','-','g')),'General service within '||rskill.name,0)
      on conflict(service_id,name) do nothing returning id into sub_id;
      if sub_id is null then select id into sub_id from public.service_catalogue_sub_services where service_id=svc_id and name='General / Any'; end if;
      insert into public.professional_sub_services(professional_id,sub_service_id,years_experience,is_primary)
      select ps.professional_id,sub_id,coalesce(ps.years_experience,0),coalesce(ps.is_primary,false)
      from public.professional_skills ps where ps.skill_id=rskill.id
      on conflict(professional_id,sub_service_id) do nothing;
    end loop;
  end loop;
end $$;

insert into public.service_catalogue_sub_services(service_id,name,slug,description,sort_order)
select s.id,x.name,lower(regexp_replace(s.slug||'-'||x.name,'[^a-zA-Z0-9]+','-','g')),x.name||' service',
       row_number() over(partition by s.id order by x.name)
from public.service_catalogue_services s
cross join lateral (
  select unnest(case
    when lower(s.name)='electrician' then array['Wiring','Fan Installation','Light Installation','Switch / Socket Repair']
    when lower(s.name)='plumber' then array['Pipe Repair','Tap Repair','Bathroom Plumbing','Kitchen Plumbing']
    when lower(s.name)='carpenter' then array['Furniture Repair','Door Repair','Cabinet Work','Custom Furniture']
    when lower(s.name)='painter' then array['Interior Painting','Exterior Painting','Wall Repair & Paint']
    when lower(s.name)='ac technician' then array['AC Service','AC Repair','AC Installation','AC Gas Refill']
    when lower(s.name)='helper' then array['Household Help','Moving Help','Event Help']
    when lower(s.name)='loader' then array['Loading','Unloading','Shifting Help']
    when lower(s.name)='mover' then array['House Shifting','Office Shifting','Packing & Moving']
    when lower(s.name)='security guard' then array['Home Security','Office Security','Event Security']
    when lower(s.name)='beautician' then array['Hair & Styling','Makeup','Facial & Skin Care']
    when lower(s.name)='cook' then array['Daily Cooking','Party Cooking','Meal Preparation']
    when lower(s.name)='driver' then array['Personal Driver','Outstation Driver','Commercial Driving']
    when lower(s.name)='accountant' then array['Bookkeeping','GST Support','Tax Records']
    when lower(s.name)='photographer' then array['Event Photography','Portrait Photography','Product Photography']
    when lower(s.name)='tutor' then array['School Tuition','Exam Preparation','Subject Coaching']
    else array['General / Any'] end) as name
) x on conflict(service_id,name) do nothing;

create or replace function public.nearby_professionals_map(
  p_latitude numeric,p_longitude numeric,p_radius_km numeric default 10,
  p_skill_id uuid default null,p_sub_service_id uuid default null
)
returns table(professional_id uuid,display_name text,headline text,city text,state text,avatar_url text,
  trust_score numeric,verification_status verification_status,is_available boolean,distance_km numeric,
  latitude numeric,longitude numeric,skills jsonb,profile_completion numeric)
language sql stable security definer set search_path=public
as $function$
with base as (
  select pp.user_id,coalesce(pr.display_name,pr.full_name,'VASUDHA Professional') display_name,
    pp.headline,pr.city,pr.state,pr.avatar_url,pp.trust_score,pp.verification_status,pp.is_available,
    pp.base_latitude latitude,pp.base_longitude longitude,
    6371*acos(least(1,greatest(-1,cos(radians(p_latitude))*cos(radians(pp.base_latitude))*
      cos(radians(pp.base_longitude)-radians(p_longitude))+sin(radians(p_latitude))*sin(radians(pp.base_latitude))))) distance
  from professional_profiles pp join profiles pr on pr.id=pp.user_id
  where pp.verification_status='verified' and pp.is_available=true and pp.base_latitude is not null and pp.base_longitude is not null
)
select b.user_id,b.display_name,b.headline,b.city,b.state,b.avatar_url,b.trust_score,b.verification_status,b.is_available,
  round(b.distance::numeric,2),b.latitude,b.longitude,
  coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'category',s.category,'primary',ps.is_primary)
    order by ps.is_primary desc,s.name) from professional_skills ps join skills s on s.id=ps.skill_id
    where ps.professional_id=b.user_id and s.is_active),'[]'::jsonb),
  round((case when nullif(trim(b.display_name),'') is not null then 15 else 0 end+
    case when nullif(trim(b.headline),'') is not null then 15 else 0 end+
    case when nullif(trim((select p.about from professional_profiles p where p.user_id=b.user_id)),'') is not null then 15 else 0 end+
    case when (select p.years_experience from professional_profiles p where p.user_id=b.user_id)>0 then 10 else 0 end+
    case when exists(select 1 from professional_skills x where x.professional_id=b.user_id) then 15 else 0 end+
    case when exists(select 1 from service_areas x where x.professional_id=b.user_id) then 15 else 0 end+
    case when exists(select 1 from portfolio_items x where x.professional_id=b.user_id) then 10 else 0 end+5)::numeric,2)
from base b where b.distance<=p_radius_km
  and (p_skill_id is null or exists(select 1 from professional_skills ps where ps.professional_id=b.user_id and ps.skill_id=p_skill_id))
  and (p_sub_service_id is null or exists(
    select 1 from professional_sub_services pss where pss.professional_id=b.user_id and pss.sub_service_id in (
      p_sub_service_id,(select g.id from service_catalogue_sub_services g
       where g.service_id=(select ss.service_id from service_catalogue_sub_services ss where ss.id=p_sub_service_id)
       and g.name='General / Any'))))
order by 13 desc,b.trust_score desc,10 asc;
$function$;

create or replace function public.rehire_professional(p_job_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $function$
declare v_job public.jobs%rowtype;v_request public.service_requests%rowtype;v_request_id uuid;
begin
  select * into v_job from public.jobs where id=p_job_id and customer_id=auth.uid();
  if not found then raise exception 'Job not found or access denied'; end if;
  if v_job.status not in ('work_completed','customer_confirmed') then raise exception 'Rehire is available after work is completed'; end if;
  if exists(select 1 from public.service_requests sr where sr.customer_id=auth.uid() and sr.professional_id=v_job.professional_id and sr.status='requested') then
    select sr.id into v_request_id from public.service_requests sr where sr.customer_id=auth.uid() and sr.professional_id=v_job.professional_id and sr.status='requested'
    order by sr.created_at desc limit 1; return v_request_id;
  end if;
  if v_job.request_id is not null then select * into v_request from public.service_requests where id=v_job.request_id; end if;
  insert into public.service_requests(customer_id,professional_id,title,description,preferred_date,preferred_time,location_text,
    location_latitude,location_longitude,service_id,sub_service_id,status)
  values(auth.uid(),v_job.professional_id,coalesce(v_request.title,v_job.title,'Repeat service'),
    coalesce(v_request.description,'Repeat the previous service with this professional.'),null,null,v_request.location_text,
    v_request.location_latitude,v_request.location_longitude,v_request.service_id,v_request.sub_service_id,'requested')
  returning id into v_request_id;
  return v_request_id;
end;
$function$;

revoke all on function public.rehire_professional(uuid) from public;
grant execute on function public.rehire_professional(uuid) to authenticated;
