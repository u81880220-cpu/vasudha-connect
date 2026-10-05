revoke execute on function public.ensure_general_any_sub_service() from anon, authenticated;
grant execute on function public.ensure_general_any_sub_service() to postgres, service_role;
revoke execute on function public.notify_complaint_status_change() from anon, authenticated;
grant execute on function public.notify_complaint_status_change() to postgres, service_role;