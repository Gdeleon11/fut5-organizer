-- STEP 3A: RLS enablement, groups, memberships, and profiles.
-- Run after group-step-2-backfill.sql.

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
  (profile_id = auth.uid() and role = 'player' and is_active = false)
  or
  (
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
using (id = auth.uid() or public.shares_group_with(id));

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
using (id = auth.uid() or public.admin_for_profile_group(id))
with check (id = auth.uid() or public.admin_for_profile_group(id));
