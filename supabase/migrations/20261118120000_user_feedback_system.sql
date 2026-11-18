create table if not exists public.user_feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 user_mode text not null check (user_mode in ('customer','professional')),
 category text not null check (category in ('bug','login','payment','suggestion','other')),
 description text not null check (char_length(trim(description)) between 10 and 5000),
 attachment_path text, app_version text, platform text, screen_path text,
 status text not null default 'new' check (status in ('new','under_review','resolved')),
 admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.user_feedback enable row level security;
revoke all on public.user_feedback from anon;
grant select,insert,update on public.user_feedback to authenticated;
drop policy if exists "feedback users insert own" on public.user_feedback;
create policy "feedback users insert own" on public.user_feedback for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "feedback users read own or admin" on public.user_feedback;
create policy "feedback users read own or admin" on public.user_feedback for select to authenticated using (user_id=(select auth.uid()) or public.is_admin());
drop policy if exists "feedback admin update" on public.user_feedback;
create policy "feedback admin update" on public.user_feedback for update to authenticated using (public.is_admin()) with check (public.is_admin());
create index user_feedback_created_at_idx on public.user_feedback(created_at desc);
create index user_feedback_status_idx on public.user_feedback(status);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('user-feedback','user-feedback',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "feedback users upload own attachment" on storage.objects;
create policy "feedback users upload own attachment" on storage.objects for insert to authenticated with check(bucket_id='user-feedback' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "feedback users read own attachment or admin" on storage.objects;
create policy "feedback users read own attachment or admin" on storage.objects for select to authenticated using(bucket_id='user-feedback' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.is_admin()));
