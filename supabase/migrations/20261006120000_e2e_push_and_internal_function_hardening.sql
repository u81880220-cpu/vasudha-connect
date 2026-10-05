-- E2E hardening: enable pg_net required by push-notification triggers
-- and prevent trigger-only SECURITY DEFINER functions from direct API execution.
create extension if not exists pg_net;

revoke all on function public.ensure_general_any_sub_service() from public, anon, authenticated;
revoke all on function public.notify_complaint_status_change() from public, anon, authenticated;
