-- VASUDHA CONNECT: connection chat layer
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique(customer_id, professional_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists conversations_customer_idx on public.conversations(customer_id, updated_at desc);
create index if not exists conversations_professional_idx on public.conversations(professional_id, updated_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at asc);

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversation participants can read" on public.conversations;
create policy "conversation participants can read" on public.conversations
for select to authenticated using (auth.uid() = customer_id or auth.uid() = professional_id);

drop policy if exists "conversation participants can create" on public.conversations;
create policy "conversation participants can create" on public.conversations
for insert to authenticated with check (auth.uid() = customer_id or auth.uid() = professional_id);

drop policy if exists "conversation participants can update" on public.conversations;
create policy "conversation participants can update" on public.conversations
for update to authenticated using (auth.uid() = customer_id or auth.uid() = professional_id)
with check (auth.uid() = customer_id or auth.uid() = professional_id);

drop policy if exists "conversation participants can read messages" on public.messages;
create policy "conversation participants can read messages" on public.messages
for select to authenticated using (
  exists (select 1 from public.conversations c
          where c.id = conversation_id and (c.customer_id = auth.uid() or c.professional_id = auth.uid()))
);

drop policy if exists "conversation participants can send messages" on public.messages;
create policy "conversation participants can send messages" on public.messages
for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c
              where c.id = conversation_id and (c.customer_id = auth.uid() or c.professional_id = auth.uid()))
);

grant select, insert, update on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

create or replace function public.get_or_create_conversation(p_professional_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.professional_connections pc
    where pc.customer_id = auth.uid()
      and pc.professional_id = p_professional_id
      and pc.expires_at > now()
  ) then
    raise exception 'Active connection required';
  end if;

  insert into public.conversations(customer_id, professional_id)
  values (auth.uid(), p_professional_id)
  on conflict(customer_id, professional_id) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare v_message public.messages;
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.customer_id = auth.uid() or c.professional_id = auth.uid())
  ) then raise exception 'Conversation access denied'; end if;

  insert into public.messages(conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), trim(p_body))
  returning * into v_message;

  update public.conversations
  set last_message_at = now(), updated_at = now()
  where id = p_conversation_id;

  return v_message;
end;
$$;

grant execute on function public.send_message(uuid,text) to authenticated;
