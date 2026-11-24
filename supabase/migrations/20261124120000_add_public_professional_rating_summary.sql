-- Expose only aggregate professional ratings to marketplace users.
-- Individual job reviews remain protected by participant-only RLS.
create or replace function public.get_professional_rating_summary(p_professional_ids uuid[])
returns table(professional_id uuid, average_rating numeric, review_count bigint)
language sql
stable
security definer
set search_path = public
as $function$
  select r.professional_id,
         round(avg((r.punctuality + r.work_quality + r.professional_behaviour + r.communication + r.value_for_money + r.reliability + r.safety_care)::numeric / 7.0), 1) as average_rating,
         count(*)::bigint as review_count
  from public.job_reviews r
  where r.professional_id = any(coalesce(p_professional_ids, '{}'::uuid[]))
  group by r.professional_id;
$function$;
revoke all on function public.get_professional_rating_summary(uuid[]) from public;
grant execute on function public.get_professional_rating_summary(uuid[]) to authenticated;
