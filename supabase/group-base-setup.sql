-- Base setup for multi-group support.
-- Run this before group-policy-tail-fix.sql if Supabase says:
-- ERROR: column matches.group_id does not exist

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

with owner_profile as (
  select id
  from public.profiles
  order by is_admin desc, created_at asc
  limit 1
),
inserted_group as (
  insert into public.groups (name, owner_id)
  select 'Mi chamusca', id
  from owner_profile
  where not exists (select 1 from public.groups)
  returning id
),
default_group as (
  select id from inserted_group
  union all
  select id
  from (
    select id
    from public.groups
    where not exists (select 1 from inserted_group)
    order by created_at asc
    limit 1
  ) existing_group
)
insert into public.group_members (group_id, profile_id, role, is_active)
select
  default_group.id,
  profiles.id,
  case when profiles.is_admin then 'admin' else 'player' end,
  profiles.is_active
from default_group
cross join public.profiles
on conflict (group_id, profile_id) do nothing;

with default_group as (
  select id from public.groups order by created_at asc limit 1
)
update public.matches
set group_id = (select id from default_group)
where group_id is null
  and exists (select 1 from default_group);

with default_group as (
  select id from public.groups order by created_at asc limit 1
)
update public.player_ratings
set group_id = (select id from default_group)
where group_id is null
  and exists (select 1 from default_group);

with default_group as (
  select id from public.groups order by created_at asc limit 1
)
update public.fines
set group_id = (select id from default_group)
where group_id is null
  and exists (select 1 from default_group);

with default_group as (
  select id from public.groups order by created_at asc limit 1
)
update public.settings
set group_id = (select id from default_group)
where group_id is null
  and exists (select 1 from default_group);

insert into public.settings (
  group_id,
  fine_amount,
  late_cancel_fine_amount,
  auto_team_threshold
)
select groups.id, 50, 25, 10
from public.groups
where not exists (
  select 1
  from public.settings
  where settings.group_id = groups.id
);

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

with ranked_settings as (
  select
    id,
    row_number() over (
      partition by group_id
      order by created_at asc, id asc
    ) as row_number
  from public.settings
  where group_id is not null
)
delete from public.settings
using ranked_settings
where settings.id = ranked_settings.id
  and ranked_settings.row_number > 1;

create unique index if not exists settings_group_unique_idx
  on public.settings(group_id)
  where group_id is not null;

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
