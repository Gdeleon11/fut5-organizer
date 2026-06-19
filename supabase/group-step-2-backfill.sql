-- STEP 2: Backfill existing single-group data into a default group.
-- Run after group-step-1-schema-functions.sql.

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
