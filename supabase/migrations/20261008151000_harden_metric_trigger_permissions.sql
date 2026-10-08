-- KAMPRO security hardening: trigger-only metric functions must not be callable via PostgREST.
revoke execute on function public.sync_professional_completion_rate() from anon, authenticated;
revoke execute on function public.sync_professional_response_rate() from anon, authenticated;
