create or replace function public.admin_service_catalogue()
returns table(service_id uuid,service_name text,service_status text,service_description text,sub_service_id uuid,sub_service_name text,sub_service_status text,professional_count bigint)
language sql security definer set search_path=public as $$
 select s.id,s.name,s.status,s.description,ss.id,ss.name,ss.status,
 (select count(*) from public.professional_sub_services pss where pss.sub_service_id=ss.id)
 from public.service_catalogue_services s
 left join public.service_catalogue_sub_services ss on ss.service_id=s.id
 where public.is_admin()
 order by s.sort_order,s.name,ss.sort_order,ss.name
$$;
revoke all on function public.admin_service_catalogue() from public,anon,authenticated;
grant execute on function public.admin_service_catalogue() to authenticated;

create or replace function public.admin_set_service_status(p_service_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 update public.service_catalogue_services set status=case when p_active then 'active' else 'inactive' end,updated_at=now() where id=p_service_id;
 if not found then raise exception 'Service not found'; end if;
end; $$;
revoke all on function public.admin_set_service_status(uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_set_service_status(uuid,boolean) to authenticated;

create or replace function public.admin_set_sub_service_status(p_sub_service_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 update public.service_catalogue_sub_services set status=case when p_active then 'active' else 'inactive' end,updated_at=now() where id=p_sub_service_id;
 if not found then raise exception 'Sub-service not found'; end if;
end; $$;
revoke all on function public.admin_set_sub_service_status(uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_set_sub_service_status(uuid,boolean) to authenticated;
