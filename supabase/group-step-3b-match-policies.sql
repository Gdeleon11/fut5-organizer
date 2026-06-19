-- STEP 3B: Ratings, matches, attendances, and teams policies.
-- Run after group-step-3a-access-policies.sql.

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
with check (public.is_group_admin(group_id) and assigned_by = auth.uid() and rating between 1 and 4);

drop policy if exists "ratings update admin" on public.player_ratings;
drop policy if exists "ratings update group admin" on public.player_ratings;
create policy "ratings update group admin"
on public.player_ratings
for update
to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id) and rating between 1 and 4);

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
      and (public.is_group_admin(matches.group_id) or attendances.profile_id = auth.uid())
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
