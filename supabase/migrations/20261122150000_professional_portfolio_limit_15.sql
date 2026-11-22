-- Enforce a hard maximum of 15 portfolio items per professional.
create or replace function public.enforce_professional_portfolio_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.portfolio_items
      where professional_id = new.professional_id
        and id is distinct from new.id) >= 15 then
    raise exception 'A professional can have at most 15 portfolio photos.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_professional_portfolio_limit on public.portfolio_items;
create trigger trg_enforce_professional_portfolio_limit
before insert or update of professional_id on public.portfolio_items
for each row execute function public.enforce_professional_portfolio_limit();

revoke all on function public.enforce_professional_portfolio_limit() from public, anon, authenticated;
