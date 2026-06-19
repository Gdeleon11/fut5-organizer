-- Run this in Supabase SQL Editor for player avatars and court photos.
-- It is safe to run more than once.

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.matches
  add column if not exists court_photo_url text;

update public.player_ratings
set rating = least(4, greatest(1, ceil(rating::numeric / 2.5)::integer))
where rating > 4;

alter table public.player_ratings
  drop constraint if exists player_ratings_rating_check;

alter table public.player_ratings
  add constraint player_ratings_rating_check
  check (rating between 1 and 4);

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
