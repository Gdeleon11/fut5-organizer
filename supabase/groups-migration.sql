-- Multi-group migration for Fut5 Organizer.
-- Run this in Supabase SQL Editor. It is safe to run more than once.

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

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.profiles enable row level security;
alter table public.player_ratings enable row level security;
alter table public.matches enable row level security;
alter table public.attendances enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.fines enable row level security;
alter table public.settings enable row level security;

drop policy if exists "groups select member" on public.groups;
create policy "groups select member"
on public.groups
for select
to authenticated
using (owner_id = auth.uid() or public.is_group_member(id));

drop policy if exists "groups insert owner" on public.groups;
create policy "groups insert owner"
on public.groups
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "groups update admin" on public.groups;
create policy "groups update admin"
on public.groups
for update
to authenticated
using (public.is_group_admin(id))
with check (public.is_group_admin(id));

drop policy if exists "group members select group" on public.group_members;
create policy "group members select group"
on public.group_members
for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists "group members join self or owner admin" on public.group_members;
create policy "group members join self or owner admin"
on public.group_members
for insert
to authenticated
with check (
  (
    profile_id = auth.uid()
    and role = 'player'
    and is_active = false
  )
  or (
    profile_id = auth.uid()
    and role = 'admin'
    and is_active = true
    and exists (
      select 1
      from public.groups
      where groups.id = group_id
        and groups.owner_id = auth.uid()
    )
  )
);

drop policy if exists "group members update admin" on public.group_members;
create policy "group members update admin"
on public.group_members
for update
to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "profiles select own or admin" on public.profiles;
drop policy if exists "profiles select own or group" on public.profiles;
create policy "profiles select own or group"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.shares_group_with(id)
);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles update own basic or admin" on public.profiles;
drop policy if exists "profiles update own basic or group admin" on public.profiles;
create policy "profiles update own basic or group admin"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.admin_for_profile_group(id)
)
with check (
  id = auth.uid()
  or public.admin_for_profile_group(id)
);

drop policy if exists "ratings select own or admin" on public.player_ratings;
drop policy if exists "ratings select group" on public.player_ratings;
create policy "ratings select group"
on public.player_ratings
for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists "ratings insert admin" on public.player_ratings;
drop policy if exists "ratings insert group admin" on public.player_ratings;
create policy "ratings insert group admin"
on public.player_ratings
for insert
to authenticated
with check (
  public.is_group_admin(group_id)
  and assigned_by = auth.uid()
  and rating between 1 and 4
);

drop policy if exists "ratings update admin" on public.player_ratings;
drop policy if exists "ratings update group admin" on public.player_ratings;
create policy "ratings update group admin"
on public.player_ratings
for update
to authenticated
using (public.is_group_admin(group_id))
with check (
  public.is_group_admin(group_id)
  and rating between 1 and 4
);

drop policy if exists "matches select authenticated" on public.matches;
drop policy if exists "matches select group" on public.matches;
create policy "matches select group"
on public.matches
for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists "matches insert admin" on public.matches;
drop policy if exists "matches insert group admin" on public.matches;
create policy "matches insert group admin"
on public.matches
for insert
to authenticated
with check (public.is_group_admin(group_id));

drop policy if exists "matches update admin" on public.matches;
drop policy if exists "matches update group admin" on public.matches;
create policy "matches update group admin"
on public.matches
for update
to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "attendances select authenticated" on public.attendances;
drop policy if exists "attendances select group" on public.attendances;
create policy "attendances select group"
on public.attendances
for select
to authenticated
using (
  exists (
    select 1
    from public.matches
    where matches.id = attendances.match_id
      and public.is_group_member(matches.group_id)
  )
);

drop policy if exists "attendances insert active self" on public.attendances;
create policy "attendances insert active self"
on public.attendances
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and status = 'confirmed'
  and checked_in = false
  and exists (
    select 1
    from public.matches
    where matches.id = attendances.match_id
      and public.is_group_active_member(matches.group_id)
  )
);

drop policy if exists "attendances update self confirm or admin" on public.attendances;
drop policy if exists "attendances update self confirm or group admin" on public.attendances;
create policy "attendances update self confirm or group admin"
on public.attendances
for update
to authenticated
using (
  exists (
    select 1
    from public.matches
    where matches.id = attendances.match_id
      and (
        public.is_group_admin(matches.group_id)
        or attendances.profile_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.matches
    where matches.id = attendances.match_id
      and (
        public.is_group_admin(matches.group_id)
        or (
          attendances.profile_id = auth.uid()
          and attendances.status in ('confirmed', 'canceled')
          and attendances.checked_in = false
          and public.is_group_active_member(matches.group_id)
        )
      )
  )
);

drop policy if exists "teams select authenticated" on public.teams;
drop policy if exists "teams select group" on public.teams;
create policy "teams select group"
on public.teams
for select
to authenticated
using (
  exists (
    select 1
    from public.matches
    where matches.id = teams.match_id
      and public.is_group_member(matches.group_id)
  )
);

drop policy if exists "teams insert admin" on public.teams;
drop policy if exists "teams insert group admin" on public.teams;
create policy "teams insert group admin"
on public.teams
for insert
to authenticated
with check (
  exists (
    select 1
    from public.matches
    where matches.id = teams.match_id
      and public.is_group_admin(matches.group_id)
  )
);

drop policy if exists "teams update admin" on public.teams;
drop policy if exists "teams update group admin" on public.teams;
create policy "teams update group admin"
on public.teams
for update
to authenticated
using (
  exists (
    select 1
    from public.matches
    where matches.id = teams.match_id
      and public.is_group_admin(matches.group_id)
  )
)
with check (
  exists (
    select 1
    from public.matches
    where matches.id = teams.match_id
      and public.is_group_admin(matches.group_id)
  )
);

drop policy if exists "teams delete admin" on public.teams;
drop policy if exists "teams delete group admin" on public.teams;
create policy "teams delete group admin"
on public.teams
for delete
to authenticated
using (
  exists (
    select 1
    from public.matches
    where matches.id = teams.match_id
      and public.is_group_admin(matches.group_id)
  )
);

drop policy if exists "team members select authenticated" on public.team_members;
drop policy if exists "team members select group" on public.team_members;
create policy "team members select group"
on public.team_members
for select
to authenticated
using (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and exists (
        select 1
        from public.matches
        where matches.id = teams.match_id
          and public.is_group_member(matches.group_id)
      )
  )
);

drop policy if exists "team members insert admin" on public.team_members;
drop policy if exists "team members insert group admin" on public.team_members;
create policy "team members insert group admin"
on public.team_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and exists (
        select 1
        from public.matches
        where matches.id = teams.match_id
          and public.is_group_admin(matches.group_id)
      )
  )
);

drop policy if exists "team members delete admin" on public.team_members;
drop policy if exists "team members delete group admin" on public.team_members;
create policy "team members delete group admin"
on public.team_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and exists (
        select 1
        from public.matches
        where matches.id = teams.match_id
          and public.is_group_admin(matches.group_id)
      )
  )
);

drop policy if exists "fines select own or admin" on public.fines;
drop policy if exists "fines select own or group admin" on public.fines;
create policy "fines select own or group admin"
on public.fines
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_group_admin(group_id)
);

drop policy if exists "fines insert admin" on public.fines;
drop policy if exists "fines insert group admin" on public.fines;
create policy "fines insert group admin"
on public.fines
for insert
to authenticated
with check (public.is_group_admin(group_id));

drop policy if exists "fines update admin" on public.fines;
drop policy if exists "fines update group admin" on public.fines;
create policy "fines update group admin"
on public.fines
for update
to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "settings select authenticated" on public.settings;
drop policy if exists "settings select group" on public.settings;
create policy "settings select group"
on public.settings
for select
to authenticated
using (public.is_group_member(group_id));

drop policy if exists "settings insert admin" on public.settings;
drop policy if exists "settings insert group admin" on public.settings;
create policy "settings insert group admin"
on public.settings
for insert
to authenticated
with check (public.is_group_admin(group_id));

drop policy if exists "settings update admin" on public.settings;
drop policy if exists "settings update group admin" on public.settings;
create policy "settings update group admin"
on public.settings
for update
to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "admins upload match photos" on storage.objects;
drop policy if exists "admins upload group match photos" on storage.objects;
create policy "admins upload group match photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'match-photos'
  and exists (
    select 1
    from public.matches
    where matches.id::text = (storage.foldername(name))[1]
      and public.is_group_admin(matches.group_id)
  )
);

drop policy if exists "admins update match photos" on storage.objects;
drop policy if exists "admins update group match photos" on storage.objects;
create policy "admins update group match photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'match-photos'
  and exists (
    select 1
    from public.matches
    where matches.id::text = (storage.foldername(name))[1]
      and public.is_group_admin(matches.group_id)
  )
)
with check (
  bucket_id = 'match-photos'
  and exists (
    select 1
    from public.matches
    where matches.id::text = (storage.foldername(name))[1]
      and public.is_group_admin(matches.group_id)
  )
);

drop policy if exists "admins delete match photos" on storage.objects;
drop policy if exists "admins delete group match photos" on storage.objects;
create policy "admins delete group match photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'match-photos'
  and exists (
    select 1
    from public.matches
    where matches.id::text = (storage.foldername(name))[1]
      and public.is_group_admin(matches.group_id)
  )
);
