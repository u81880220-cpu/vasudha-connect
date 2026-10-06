create or replace function public.admin_analytics()
returns jsonb language plpgsql security definer set search_path=public
as $function$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 return jsonb_build_object(
 'users',(select count(*) from public.profiles),'professionals',(select count(*) from public.professional_profiles),
 'verified_professionals',(select count(*) from public.professional_profiles where verification_status='verified'),
 'active_connections',(select count(*) from public.professional_connections where expires_at>now()),
 'connection_unlocks',(select count(*) from public.connection_purchases),
 'active_subscriptions',(select count(*) from public.professional_subscriptions where status='active'),
 'subscription_count',(select count(*) from public.professional_subscriptions),'jobs',(select count(*) from public.jobs),
 'completed_jobs',(select count(*) from public.jobs where status in ('work_completed','customer_confirmed')),
 'reviews',(select count(*) from public.job_reviews),
 'connection_revenue',(select coalesce(sum(amount_inr),0) from public.connection_payment_orders where status='paid'),
 'subscription_revenue',(select coalesce(sum(amount_inr),0) from public.professional_subscription_payment_orders where status='paid'),
 'connection_revenue_30d',(select coalesce(sum(amount_inr),0) from public.connection_payment_orders where status='paid' and paid_at>=now()-interval '30 days'),
 'subscription_revenue_30d',(select coalesce(sum(amount_inr),0) from public.professional_subscription_payment_orders where status='paid' and created_at>=now()-interval '30 days'),
 'new_users_30d',(select count(*) from public.profiles where created_at>=now()-interval '30 days'),
 'new_professionals_30d',(select count(*) from public.professional_profiles where created_at>=now()-interval '30 days'),
 'new_connections_30d',(select count(*) from public.professional_connections where purchased_at>=now()-interval '30 days'));
end;
$function$;

create or replace function public.admin_customer_reputation()
returns table(user_id uuid, display_name text, city text, state text, customer_trust_score numeric, jobs_completed bigint, reviews_received bigint, would_work_again_pct numeric)
language plpgsql security definer set search_path=public
as $function$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 return query select p.id,p.display_name,p.city,p.state,coalesce(p.customer_trust_score,0),
 (select count(*) from jobs j where j.customer_id=p.id and j.status='customer_confirmed'),
 (select count(*) from customer_job_reviews r where r.customer_id=p.id),
 (select coalesce(round(avg(case when r.would_hire_again then 100 else 0 end)),0) from customer_job_reviews r where r.customer_id=p.id)
 from profiles p where exists(select 1 from user_roles ur where ur.user_id=p.id and ur.role='customer')
 order by coalesce(p.customer_trust_score,0) desc;
end;
$function$;

create or replace function public.cancel_job(p_job_id uuid,p_reason text default null)
returns public.jobs language plpgsql security definer set search_path=public
as $function$
declare j public.jobs; other_user uuid; reason text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into j from public.jobs where id=p_job_id and (customer_id=auth.uid() or professional_id=auth.uid()) for update;
 if j.id is null then raise exception 'Job not found or access denied'; end if;
 if j.status not in ('worker_accepted'::job_status,'on_the_way'::job_status,'arrived'::job_status) then raise exception 'This job can no longer be cancelled. Please report a problem instead.'; end if;
 reason:=nullif(left(trim(coalesce(p_reason,'')),500),'');
 update public.jobs set status='cancelled'::job_status,cancelled_by=auth.uid(),cancellation_reason=reason,cancelled_at=now(),updated_at=now() where id=p_job_id returning * into j;
 update public.service_requests set status='withdrawn'::quote_status,updated_at=now() where id=j.request_id and status in ('requested'::quote_status,'accepted'::quote_status);
 update public.professional_profiles set is_available=true,updated_at=now() where user_id=j.professional_id;
 other_user:=case when auth.uid()=j.customer_id then j.professional_id else j.customer_id end;
 perform public._create_notification_internal(other_user,'job','Job cancelled','A job has been cancelled by the other participant.',jsonb_build_object('job_id',j.id,'status',j.status::text,'cancelled_by',auth.uid(),'reason',reason));
 return j;
end;
$function$;

create or replace function public.update_job_status(p_job_id uuid,p_status job_status)
returns public.jobs language plpgsql security definer set search_path=public
as $function$
declare j public.jobs; allowed boolean:=false;
begin
 select * into j from public.jobs where id=p_job_id and (customer_id=auth.uid() or professional_id=auth.uid());
 if j.id is null then raise exception 'Job not found or access denied'; end if;
 if p_status='customer_confirmed' then
   if j.customer_id<>auth.uid() or j.status<>'work_completed' then raise exception 'Customer confirmation is allowed only after work is completed'; end if;
   update public.jobs set status=p_status,customer_confirmed_at=now(),updated_at=now() where id=p_job_id returning * into j;
 elsif j.professional_id=auth.uid() then
   allowed := (j.status='worker_accepted' and p_status='on_the_way') or (j.status='on_the_way' and p_status='arrived') or (j.status='arrived' and p_status='work_started') or (j.status='work_started' and p_status='work_completed');
   if not allowed then raise exception 'Invalid job status transition'; end if;
   if p_status='work_completed' then
     update public.jobs set status=p_status,completed_at=now(),updated_at=now() where id=p_job_id returning * into j;
     update public.professional_profiles set is_available=true,updated_at=now() where user_id=auth.uid();
   else update public.jobs set status=p_status,updated_at=now() where id=p_job_id returning * into j; end if;
 else raise exception 'Only the assigned professional can update this status'; end if;
 return j;
end;
$function$;

create or replace function public.get_job_contact_details(p_job_id uuid)
returns jsonb language sql stable security definer set search_path=public as $function$
select case
 when j.id is null then '{}'::jsonb
 when auth.uid()=j.professional_id and j.status in ('worker_accepted','on_the_way','arrived','work_started','work_completed','customer_confirmed') then
   jsonb_build_object('customer_phone',(select phone from user_contact_details where user_id=j.customer_id),'location_text',r.location_text,'latitude',r.location_latitude,'longitude',r.location_longitude,'customer_name',coalesce(cp.display_name,cp.full_name,'Customer'))
 when auth.uid()=j.customer_id and j.status in ('worker_accepted','on_the_way','arrived','work_started','work_completed','customer_confirmed') then
   jsonb_build_object('professional_phone',(select phone from user_contact_details where user_id=j.professional_id),'location_text',r.location_text,'latitude',r.location_latitude,'longitude',r.location_longitude,'professional_name',coalesce(pp.display_name,pp.full_name,'Professional'))
 when auth.uid()=j.customer_id then
   jsonb_build_object('professional_phone',(select phone from user_contact_details where user_id=j.professional_id),'professional_name',coalesce(pp.display_name,pp.full_name,'Professional'))
 else '{}'::jsonb end
from jobs j join service_requests r on r.id=j.request_id
left join profiles cp on cp.id=j.customer_id left join profiles pp on pp.id=j.professional_id
where j.id=p_job_id;
$function$;