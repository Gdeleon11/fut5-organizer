create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  nickname text,
  phone text,
  preferred_position text,
  avatar_url text,
  is_active boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text;

create table if not exists public.player_ratings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 4),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  title text,
  match_date date,
  start_time text,
  venue text,
  court_photo_url text,
  min_players integer not null default 10,
  max_players integer not null default 18,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'closed', 'canceled')),
  created_at timestamptz not null default now()
);

alter table public.matches
  add column if not exists court_photo_url text;

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'canceled', 'checked_in', 'no_show')),
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, profile_id)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  name text,
  team_order integer,
  total_rating integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

create table if not exists public.fines (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  reason text,
  amount numeric not null default 0,
  status text not null default 'open'
    check (status in ('open', 'paid', 'forgiven')),
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  fine_amount numeric not null default 50,
  late_cancel_fine_amount numeric not null default 25,
  auto_team_threshold integer not null default 10,
  created_at timestamptz not null default now()
);

create index if not exists profiles_is_active_idx on public.profiles(is_active);
create index if not exists player_ratings_profile_created_idx
  on public.player_ratings(profile_id, created_at desc);
create index if not exists matches_date_idx on public.matches(match_date);
create index if not exists attendances_match_idx on public.attendances(match_id);
create index if not exists attendances_profile_idx on public.attendances(profile_id);
create index if not exists fines_profile_status_idx on public.fines(profile_id, status);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists attendances_set_updated_at on public.attendances;
create trigger attendances_set_updated_at
before update on public.attendances
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select profiles.is_admin from public.profiles where profiles.id = auth.uid()),
    false
  );
$$;

create or replace function public.current_profile_is_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select profiles.is_active from public.profiles where profiles.id = auth.uid()),
    false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    nickname,
    phone,
    preferred_position
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'preferred_position', 'Flexible')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

drop trigger if exists protect_profile_admin_fields on public.profiles;
create trigger protect_profile_admin_fields
before update on public.profiles
for each row execute function public.protect_profile_admin_fields();

alter table public.profiles enable row level security;
alter table public.player_ratings enable row level security;
alter table public.matches enable row level security;
alter table public.attendances enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.fines enable row level security;
alter table public.settings enable row level security;

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

drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.team_members self_member
    join public.teams self_team on self_team.id = self_member.team_id
    join public.teams visible_team on visible_team.match_id = self_team.match_id
    join public.team_members visible_member on visible_member.team_id = visible_team.id
    where self_member.profile_id = auth.uid()
      and visible_member.profile_id = profiles.id
  )
);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles update own basic or admin" on public.profiles;
create policy "profiles update own basic or admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "ratings select own or admin" on public.player_ratings;
create policy "ratings select own or admin"
on public.player_ratings
for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "ratings insert admin" on public.player_ratings;
create policy "ratings insert admin"
on public.player_ratings
for insert
to authenticated
with check (public.is_admin() and assigned_by = auth.uid());

drop policy if exists "ratings update admin" on public.player_ratings;
create policy "ratings update admin"
on public.player_ratings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "matches select authenticated" on public.matches;
create policy "matches select authenticated"
on public.matches
for select
to authenticated
using (true);

drop policy if exists "matches insert admin" on public.matches;
create policy "matches insert admin"
on public.matches
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "matches update admin" on public.matches;
create policy "matches update admin"
on public.matches
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "attendances select authenticated" on public.attendances;
create policy "attendances select authenticated"
on public.attendances
for select
to authenticated
using (true);

drop policy if exists "attendances insert active self" on public.attendances;
create policy "attendances insert active self"
on public.attendances
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and status = 'confirmed'
  and checked_in = false
  and public.current_profile_is_active()
);

drop policy if exists "attendances update self confirm or admin" on public.attendances;
create policy "attendances update self confirm or admin"
on public.attendances
for update
to authenticated
using (profile_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    profile_id = auth.uid()
    and status in ('confirmed', 'canceled')
    and checked_in = false
    and public.current_profile_is_active()
  )
);

drop policy if exists "teams select authenticated" on public.teams;
create policy "teams select authenticated"
on public.teams
for select
to authenticated
using (true);

drop policy if exists "teams insert admin" on public.teams;
create policy "teams insert admin"
on public.teams
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "teams update admin" on public.teams;
create policy "teams update admin"
on public.teams
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "teams delete admin" on public.teams;
create policy "teams delete admin"
on public.teams
for delete
to authenticated
using (public.is_admin());

drop policy if exists "team members select authenticated" on public.team_members;
create policy "team members select authenticated"
on public.team_members
for select
to authenticated
using (true);

drop policy if exists "team members insert admin" on public.team_members;
create policy "team members insert admin"
on public.team_members
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "team members delete admin" on public.team_members;
create policy "team members delete admin"
on public.team_members
for delete
to authenticated
using (public.is_admin());

drop policy if exists "fines select own or admin" on public.fines;
create policy "fines select own or admin"
on public.fines
for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "fines insert admin" on public.fines;
create policy "fines insert admin"
on public.fines
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "fines update admin" on public.fines;
create policy "fines update admin"
on public.fines
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "settings select authenticated" on public.settings;
create policy "settings select authenticated"
on public.settings
for select
to authenticated
using (true);

drop policy if exists "settings insert admin" on public.settings;
create policy "settings insert admin"
on public.settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "settings update admin" on public.settings;
create policy "settings update admin"
on public.settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.settings (
  fine_amount,
  late_cancel_fine_amount,
  auto_team_threshold
)
select 50, 25, 10
where not exists (select 1 from public.settings);
