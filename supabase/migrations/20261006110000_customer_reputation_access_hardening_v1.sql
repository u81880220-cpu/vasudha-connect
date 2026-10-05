create or replace function get_customer_reputation(p_customer_id uuid)
returns jsonb
language sql
security definer
set search_path=public
as $$
select case
  when auth.uid()=p_customer_id
    or exists(select 1 from jobs j where j.customer_id=p_customer_id and j.professional_id=auth.uid())
    or exists(select 1 from service_requests sr where sr.customer_id=p_customer_id and sr.professional_id=auth.uid())
  then jsonb_build_object(
    'customer_id',p_customer_id,
    'trust_score',coalesce(p.customer_trust_score,0),
    'jobs_completed',(select count(*) from jobs where customer_id=p_customer_id and status='customer_confirmed'),
    'reviews_received',(select count(*) from customer_job_reviews where customer_id=p_customer_id),
    'would_work_again',(select coalesce(round(avg(case when would_hire_again then 100 else 0 end)),0) from customer_job_reviews where customer_id=p_customer_id)
  )
  else null
end
from profiles p
where p.id=p_customer_id;
$$;