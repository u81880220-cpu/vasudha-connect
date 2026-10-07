create or replace function public.admin_customer_360(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_user_id is null then raise exception 'Customer is required'; end if;

  select jsonb_build_object(
    'user_id', p_user_id,
    'profile', coalesce((select to_jsonb(pr) from public.profiles pr where pr.id = p_user_id),'{}'::jsonb),
    'connections', jsonb_build_object(
      'total', (select count(*) from public.professional_connections pc where pc.customer_id=p_user_id),
      'active', (select count(*) from public.professional_connections pc where pc.customer_id=p_user_id and pc.expires_at>now()),
      'recent', coalesce((select jsonb_agg(to_jsonb(cx) order by cx.purchased_at desc)
        from (select pc.id,pc.professional_id,coalesce(pr.display_name,pr.full_name,'Professional') professional_name,pc.purchased_at,pc.expires_at,pc.last_accessed_at
              from public.professional_connections pc left join public.profiles pr on pr.id=pc.professional_id
              where pc.customer_id=p_user_id order by pc.purchased_at desc limit 10) cx),'[]'::jsonb)
    ),
    'purchases', jsonb_build_object(
      'total',(select count(*) from public.connection_purchases cp where cp.user_id=p_user_id),
      'connections_purchased',coalesce((select sum(cp.connections) from public.connection_purchases cp where cp.user_id=p_user_id),0),
      'amount_inr',coalesce((select sum(cp.price_inr) from public.connection_purchases cp where cp.user_id=p_user_id),0)
    ),
    'work', jsonb_build_object(
      'requests_total',(select count(*) from public.service_requests sr where sr.customer_id=p_user_id),
      'jobs_total',(select count(*) from public.jobs j where j.customer_id=p_user_id),
      'jobs_completed',(select count(*) from public.jobs j where j.customer_id=p_user_id and j.status='customer_confirmed'),
      'jobs_cancelled',(select count(*) from public.jobs j where j.customer_id=p_user_id and j.status='cancelled'),
      'recent_jobs',coalesce((select jsonb_agg(to_jsonb(jx) order by jx.created_at desc)
        from (select j.id,j.title,j.status,j.agreed_amount_inr,j.professional_id,coalesce(pr.display_name,pr.full_name,'Professional') professional_name,j.created_at,j.completed_at
              from public.jobs j left join public.profiles pr on pr.id=j.professional_id
              where j.customer_id=p_user_id order by j.created_at desc limit 10) jx),'[]'::jsonb)
    ),
    'reviews', jsonb_build_object(
      'total',(select count(*) from public.job_reviews r where r.customer_id=p_user_id),
      'average',coalesce((select round(avg((r.punctuality+r.work_quality+r.professional_behaviour+r.communication+r.value_for_money+r.reliability+r.safety_care)::numeric/7),2) from public.job_reviews r where r.customer_id=p_user_id),0),
      'would_hire_again_pct',coalesce((select round(100.0*avg(case when r.would_hire_again then 1 else 0 end),1) from public.job_reviews r where r.customer_id=p_user_id),0)
    ),
    'complaints',jsonb_build_object(
      'total',(select count(*) from public.complaints c where c.reporter_id=p_user_id or c.against_user_id=p_user_id),
      'open',(select count(*) from public.complaints c where (c.reporter_id=p_user_id or c.against_user_id=p_user_id) and c.status not in ('resolved'))
    ),
    'notifications',jsonb_build_object(
      'total',(select count(*) from public.notifications n where n.user_id=p_user_id),
      'unread',(select count(*) from public.notifications n where n.user_id=p_user_id and n.read_at is null)
    )
  ) into v_result;
  return v_result;
end;
$function$;