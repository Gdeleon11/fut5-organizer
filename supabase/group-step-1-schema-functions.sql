-- STEP 1: Multi-group tables, columns, triggers, and helper functions.
-- Run this whole file first.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player' check (role in ('admin', 'player')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

alter table public.player_ratings
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

alter table public.matches
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

alter table public.fines
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

alter table public.settings
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

drop trigger if exists group_members_set_updated_at on public.group_members;
create trigger group_members_set_updated_at
before update on public.group_members
for each row execute function public.set_updated_at();

create index if not exists groups_owner_idx on public.groups(owner_id);
create index if not exists group_members_profile_idx
  on public.group_members(profile_id);
create index if not exists group_members_group_role_idx
  on public.group_members(group_id, role);
create index if not exists player_ratings_group_profile_created_idx
  on public.player_ratings(group_id, profile_id, created_at desc);
create index if not exists matches_group_date_idx
  on public.matches(group_id, match_date);
create index if not exists fines_group_profile_status_idx
  on public.fines(group_id, profile_id, status);

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.group_members
      where group_members.group_id = target_group_id
        and group_members.profile_id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_group_active_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.group_members
      where group_members.group_id = target_group_id
        and group_members.profile_id = auth.uid()
        and group_members.is_active = true
    ),
    false
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.group_members
      where group_members.group_id = target_group_id
        and group_members.profile_id = auth.uid()
        and group_members.role = 'admin'
    ),
    false
  );
$$;

create or replace function public.shares_group_with(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.group_members self_membership
      join public.group_members target_membership
        on target_membership.group_id = self_membership.group_id
      where self_membership.profile_id = auth.uid()
        and target_membership.profile_id = target_profile_id
    ),
    false
  );
$$;

create or replace function public.admin_for_profile_group(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    exists (
      select 1
      from public.group_members admin_membership
      join public.group_members target_membership
        on target_membership.group_id = admin_membership.group_id
      where admin_membership.profile_id = auth.uid()
        and admin_membership.role = 'admin'
        and target_membership.profile_id = target_profile_id
    ),
    false
  );
$$;
