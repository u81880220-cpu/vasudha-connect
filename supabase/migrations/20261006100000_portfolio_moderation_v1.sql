create type portfolio_moderation_status as enum ('pending','approved','rejected');

alter table portfolio_items
  add column moderation_status portfolio_moderation_status not null default 'pending',
  add column moderation_note text,
  add column reviewed_by uuid references auth.users(id),
  add column reviewed_at timestamptz;

create index portfolio_items_moderation_idx on portfolio_items(moderation_status, created_at desc);

create or replace function trg_portfolio_requires_moderation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    new.moderation_status:='pending'; new.reviewed_by:=null; new.reviewed_at:=null; new.moderation_note:=null;
  elsif tg_op='UPDATE' and (new.title is distinct from old.title or new.description is distinct from old.description or new.media_url is distinct from old.media_url) then
    new.moderation_status:='pending'; new.reviewed_by:=null; new.reviewed_at:=null; new.moderation_note:=null;
  end if;
  return new;
end; $$;

drop trigger if exists trg_portfolio_requires_moderation on portfolio_items;
create trigger trg_portfolio_requires_moderation before insert or update on portfolio_items
for each row execute function trg_portfolio_requires_moderation();

create or replace function admin_portfolio_moderation()
returns table(id uuid,professional_id uuid,professional_name text,title text,description text,media_url text,moderation_status portfolio_moderation_status,moderation_note text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select pi.id,pi.professional_id,coalesce(pr.display_name,pr.full_name,'Professional'),pi.title,pi.description,pi.media_url,pi.moderation_status,pi.moderation_note,pi.created_at
 from portfolio_items pi join profiles pr on pr.id=pi.professional_id
 where is_admin()
 order by case when pi.moderation_status='pending' then 0 else 1 end,pi.created_at desc;
$$;

create or replace function admin_review_portfolio(p_portfolio_id uuid,p_decision portfolio_moderation_status,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'admin access required'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'decision must be approved or rejected'; end if;
 update portfolio_items set moderation_status=p_decision,moderation_note=left(nullif(trim(p_note),''),1000),reviewed_by=auth.uid(),reviewed_at=now() where id=p_portfolio_id;
 if not found then raise exception 'portfolio item not found'; end if;
end; $$;

revoke all on function admin_portfolio_moderation() from public,anon,authenticated;
grant execute on function admin_portfolio_moderation() to authenticated;
revoke all on function admin_review_portfolio(uuid,portfolio_moderation_status,text) from public,anon,authenticated;
grant execute on function admin_review_portfolio(uuid,portfolio_moderation_status,text) to authenticated;