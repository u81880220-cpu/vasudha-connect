-- Only Customer mode may consume connection credits or create customer job requests.
-- Keep server-side checks authoritative so direct RPC calls cannot bypass the UI.
CREATE OR REPLACE FUNCTION public.unlock_professional(p_professional_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_sub public.professional_subscriptions%rowtype;
  v_limit integer;
  v_price numeric;
  v_interval text;
  v_end timestamptz;
  v_check jsonb;
  v_mode public.app_mode;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select current_mode into v_mode from public.profiles where id=auth.uid();
  if v_mode is distinct from 'customer'::public.app_mode then
    raise exception 'Switch to Customer mode to unlock another professional.';
  end if;
  if auth.uid() = p_professional_id then raise exception 'You cannot unlock your own professional profile'; end if;
  v_check := public.professional_connection_eligibility(p_professional_id);
  if coalesce((v_check->>'eligible')::boolean, false) is not true then
    raise exception '%', coalesce(v_check->>'reason', 'This professional cannot receive new customer connections right now.');
  end if;
  if exists (select 1 from public.professional_connections where customer_id=auth.uid() and professional_id=p_professional_id and expires_at>now()) then
    update public.professional_connections set last_accessed_at=now(), expires_at='infinity'::timestamptz
    where customer_id=auth.uid() and professional_id=p_professional_id;
    return true;
  end if;
  select s.* into v_sub from public.professional_subscriptions s
  where s.professional_id=p_professional_id and s.status='active' and s.current_period_end>now()
  order by s.created_at desc limit 1 for update;
  if v_sub.id is null then raise exception 'This professional cannot receive new job requests right now'; end if;
  select connection_limit,price_inr,billing_interval into v_limit,v_price,v_interval
  from public.professional_subscription_plans where id=v_sub.plan_id and status='active';
  if v_limit is null then raise exception 'Professional subscription plan is unavailable'; end if;
  if v_sub.connections_used>=v_limit then raise exception 'This professional has reached the connection limit for this subscription period'; end if;
  perform public.consume_customer_connection_credit(auth.uid());
  insert into public.professional_connections(customer_id,professional_id,expires_at,last_accessed_at)
  values(auth.uid(),p_professional_id,'infinity'::timestamptz,now())
  on conflict(customer_id,professional_id) do update
  set expires_at='infinity'::timestamptz,last_accessed_at=now(),purchased_at=now(),last_job_request_id=null;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_service_request(
  p_professional_id uuid,p_service_id uuid,p_sub_service_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,p_description text DEFAULT NULL,p_preferred_date date DEFAULT NULL,
  p_preferred_time text DEFAULT NULL,p_location_text text DEFAULT NULL,
  p_location_latitude numeric DEFAULT NULL,p_location_longitude numeric DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_request_id uuid;
  v_title text;
  v_service_name text;
  v_sub_service_name text;
  v_mode public.app_mode;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select current_mode into v_mode from public.profiles where id=auth.uid();
  if v_mode is distinct from 'customer'::public.app_mode then
    raise exception 'Switch to Customer mode to create a job request.';
  end if;
  if p_professional_id is null or p_service_id is null then raise exception 'Professional and service are required'; end if;
  if auth.uid()=p_professional_id then raise exception 'You cannot book your own professional service. Please choose another professional.'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_professional_id::text));
  if exists (
    select 1 from public.service_requests sr left join public.jobs j on j.request_id=sr.id
    where sr.customer_id=auth.uid() and sr.professional_id=p_professional_id
      and sr.status::text in ('requested','submitted','accepted')
      and (j.id is null or j.status::text not in ('customer_confirmed','cancelled'))
  ) then raise exception 'You already have an active job with this professional. Please complete or cancel it before creating another job.'; end if;
  select s.name into v_service_name from public.service_catalogue_services s where s.id=p_service_id and s.status='active';
  if v_service_name is null then raise exception 'Selected service is not active'; end if;
  if p_sub_service_id is not null then
    select ss.name into v_sub_service_name from public.service_catalogue_sub_services ss
    where ss.id=p_sub_service_id and ss.service_id=p_service_id and ss.status='active';
    if v_sub_service_name is null then raise exception 'Selected sub-service is not valid'; end if;
  end if;
  v_title:=nullif(trim(coalesce(p_title,'')),'');
  if v_title is null then v_title:=coalesce(v_sub_service_name,v_service_name); end if;
  if nullif(trim(coalesce(p_location_text,'')),'') is null then raise exception 'Service location is required'; end if;
  if p_location_latitude is not null and (p_location_latitude < -90 or p_location_latitude > 90) then raise exception 'Invalid latitude'; end if;
  if p_location_longitude is not null and (p_location_longitude < -180 or p_location_longitude > 180) then raise exception 'Invalid longitude'; end if;
  if not exists (select 1 from public.professional_profiles pp where pp.user_id=p_professional_id and pp.verification_status='verified'::verification_status and pp.is_available=true) then
    raise exception 'Professional is not currently available';
  end if;
  if not exists (select 1 from public.professional_connections pc where pc.customer_id=auth.uid() and pc.professional_id=p_professional_id and (pc.expires_at is null or pc.expires_at>now())) then
    raise exception 'Unlock this professional before sending a job request';
  end if;
  if p_sub_service_id is not null and not exists (select 1 from public.professional_sub_services ps where ps.professional_id=p_professional_id and ps.sub_service_id=p_sub_service_id) then
    raise exception 'Professional does not offer the selected sub-service';
  end if;
  insert into public.service_requests(customer_id,professional_id,service_id,sub_service_id,title,description,preferred_date,preferred_time,location_text,location_latitude,location_longitude)
  values(auth.uid(),p_professional_id,p_service_id,p_sub_service_id,v_title,nullif(trim(coalesce(p_description,'')),''),p_preferred_date,nullif(trim(coalesce(p_preferred_time,'')),''),trim(p_location_text),p_location_latitude,p_location_longitude)
  returning id into v_request_id;
  return v_request_id;
end;
$function$;
