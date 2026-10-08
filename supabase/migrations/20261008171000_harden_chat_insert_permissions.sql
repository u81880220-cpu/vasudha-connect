-- KAMPRO: all client chat sends must use the guarded send_message RPC.
-- 2026-10-08
drop policy if exists "conversation participants can send messages" on public.messages;
revoke insert on table public.messages from anon, authenticated;