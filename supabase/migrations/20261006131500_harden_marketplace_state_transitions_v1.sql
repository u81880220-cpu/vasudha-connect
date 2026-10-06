-- Harden marketplace state transitions: clients must use validated RPCs.
drop policy if exists "job participants update" on public.jobs;
drop policy if exists "customers update own requests" on public.service_requests;
drop policy if exists "quote participants update" on public.quotes;

-- These tables remain readable to their intended participants and writable only through
-- purpose-built RPCs such as accept_quote, accept_service_request, create_job_from_quote,
-- update_job_status and cancel_job.
