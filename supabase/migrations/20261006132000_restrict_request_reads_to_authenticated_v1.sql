-- Restrict participant request reads to authenticated sessions.
drop policy if exists "customers read own requests" on public.service_requests;
drop policy if exists "professionals read accepted requests" on public.service_requests;

create policy "customers read own requests"
on public.service_requests
for select to authenticated
using (auth.uid() = customer_id);

create policy "professionals read accepted requests"
on public.service_requests
for select to authenticated
using (
  auth.uid() = professional_id
  and exists (
    select 1 from public.jobs j
    where j.request_id = service_requests.id
  )
);
