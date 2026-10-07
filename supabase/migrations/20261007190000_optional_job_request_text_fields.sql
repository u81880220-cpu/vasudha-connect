alter table public.service_requests
  alter column title drop not null;

alter table public.service_requests
  alter column description drop not null;
