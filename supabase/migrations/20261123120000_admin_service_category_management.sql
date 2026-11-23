create or replace function public.admin_save_service_category(
  p_action text,
  p_category_id uuid default null,
  p_name text default null,
  p_slug text default null,
  p_icon text default null,
  p_description text default null,
  p_status text default 'active',
  p_sort_order integer default 0
)
returns uuid language plpgsql security definer set search_path=public
as $function$
declare v_id uuid; v_slug text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('create','update') then raise exception 'Invalid category action'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Category name is required'; end if;
  if p_status not in ('active','inactive') then raise exception 'Invalid category status'; end if;
  v_slug := coalesce(nullif(trim(p_slug),''),nullif(trim(both '-' from regexp_replace(lower(trim(p_name)),'[^a-z0-9]+','-','g')),''),'category');
  if p_action='create' then
    insert into public.service_categories(name,slug,icon,description,status,sort_order,updated_at)
    values(trim(p_name),v_slug,nullif(trim(p_icon),''),nullif(trim(p_description),''),p_status,coalesce(p_sort_order,0),now())
    returning id into v_id;
  else
    update public.service_categories set name=trim(p_name),slug=v_slug,icon=nullif(trim(p_icon),''),description=nullif(trim(p_description),''),status=p_status,sort_order=coalesce(p_sort_order,0),updated_at=now()
    where id=p_category_id returning id into v_id;
    if v_id is null then raise exception 'Category not found'; end if;
  end if;
  return v_id;
end
$function$;
revoke all on function public.admin_save_service_category(text,uuid,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.admin_save_service_category(text,uuid,text,text,text,text,text,integer) to authenticated;
