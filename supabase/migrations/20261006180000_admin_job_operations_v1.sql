create or replace function public.admin_job_operations()
returns table(
 job_id uuid,request_id uuid,customer_id uuid,professional_id uuid,title text,status text,
 request_status text,preferred_date date,preferred_time text,location_text text,
 location_latitude numeric,location_longitude numeric,
 live_latitude numeric,live_longitude numeric,live_accuracy_m numeric,live_updated_at timestamptz,
 created_at timestamptz,updated_at timestamptz,completed_at timestamptz,cancelled_at timestamptz,
 has_customer_review boolean
)
language sql security definer set search_path=public as $$
 select j.id,j.request_id,j.customer_id,j.professional_id,j.title,j.status::text,
        r.status::text,r.preferred_date,r.preferred_time,r.location_text,
        r.location_latitude,r.location_longitude,
        l.latitude,l.longitude,l.accuracy_m,l.updated_at,
        j.created_at,j.updated_at,j.completed_at,j.cancelled_at,
        exists(select 1 from public.job_reviews jr where jr.job_id=j.id)
 from public.jobs j
 left join public.service_requests r on r.id=j.request_id
 left join public.job_live_locations l on l.job_id=j.id
 where public.is_admin()
 order by j.updated_at desc limit 500
$$;
revoke all on function public.admin_job_operations() from public,anon,authenticated;
grant execute on function public.admin_job_operations() to authenticated;

create or replace function public.admin_cancel_job(p_job_id uuid,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_status text; v_request uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select status::text,request_id into v_status,v_request from public.jobs where id=p_job_id for update;
 if v_status is null then raise exception 'Job not found'; end if;
 if v_status not in ('worker_accepted','on_the_way','arrived') then raise exception 'This job cannot be cancelled from its current status'; end if;
 update public.jobs set status='cancelled',cancelled_by=auth.uid(),cancellation_reason=nullif(trim(p_reason),''),cancelled_at=now(),updated_at=now() where id=p_job_id;
 if v_request is not null then update public.service_requests set status='withdrawn',updated_at=now() where id=v_request and status in ('requested','accepted'); end if;
end;
$$;
revoke all on function public.admin_cancel_job(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_cancel_job(uuid,text) to authenticated;
