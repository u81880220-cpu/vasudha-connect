-- This read model contains private conversation state and is only needed by signed-in clients.
revoke all on function public.get_conversation_chat_state(uuid) from public, anon;
grant execute on function public.get_conversation_chat_state(uuid) to authenticated;

-- These functions are invoked by database triggers, not by API clients.
revoke all on function public.sync_professional_completion_rate() from public, anon, authenticated;
revoke all on function public.sync_professional_response_rate() from public, anon, authenticated;
revoke all on function public.validate_completed_work_portfolio_photo() from public, anon, authenticated;
