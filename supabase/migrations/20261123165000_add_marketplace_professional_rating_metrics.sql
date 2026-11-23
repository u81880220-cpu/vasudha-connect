-- Expose only aggregate public reputation metrics for verified professionals.
-- Rating follows the same seven-dimension average used by the professional dashboard.
create or replace function public.marketplace_professional_ratings(p_professional_ids uuid[])
returns table(
  professional_id uuid,
  average_rating numeric,
  review_count bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    pp.user_id,
    round(avg((
      jr.punctuality
      + jr.work_quality
      + jr.professional_behaviour
      + jr.communication
      + jr.value_for_money
      + jr.reliability
      + jr.safety_care
    )::numeric / 7), 2) as average_rating,
    count(jr.id) as review_count
  from public.professional_profiles pp
  left join public.job_reviews jr on jr.professional_id = pp.user_id
  where pp.user_id = any(coalesce(p_professional_ids, '{}'::uuid[]))
    and pp.verification_status = 'verified'
  group by pp.user_id;
$function$;

revoke all on function public.marketplace_professional_ratings(uuid[]) from public;
grant execute on function public.marketplace_professional_ratings(uuid[]) to anon, authenticated;
