-- Run this in Supabase SQL Editor after the main schema.
-- Change the email if your admin account uses a different address.

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.matches
  add column if not exists court_photo_url text;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    new.is_active = old.is_active;
    new.is_admin = old.is_admin;
  end if;

  return new;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'match-photos',
  'match-photos',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "match photos are publicly readable" on storage.objects;
create policy "match photos are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'match-photos');

drop policy if exists "admins upload match photos" on storage.objects;
create policy "admins upload match photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'match-photos'
  and public.is_admin()
);

drop policy if exists "admins update match photos" on storage.objects;
create policy "admins update match photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'match-photos'
  and public.is_admin()
)
with check (
  bucket_id = 'match-photos'
  and public.is_admin()
);

drop policy if exists "admins delete match photos" on storage.objects;
create policy "admins delete match photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'match-photos'
  and public.is_admin()
);

insert into public.profiles (id, full_name, preferred_position)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'full_name', ''),
  'Flexible'
from auth.users as users
where lower(users.email) = lower('guilledeleon@gmail.com')
on conflict (id) do nothing;

update public.profiles
set is_admin = true
where id = (
  select users.id
  from auth.users as users
  where lower(users.email) = lower('guilledeleon@gmail.com')
)
returning id, full_name, nickname, is_admin;
