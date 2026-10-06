drop policy if exists "customer can review completed job" on public.job_reviews;
create policy "customer can review completed job"
on public.job_reviews
for insert
to authenticated
with check (
  auth.uid() = customer_id
  and exists (
    select 1
    from public.jobs j
    where j.id = job_reviews.job_id
      and j.customer_id = auth.uid()
      and j.status = 'customer_confirmed'::job_status
  )
);
