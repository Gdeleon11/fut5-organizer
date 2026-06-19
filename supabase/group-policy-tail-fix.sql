-- Emergency policy tail fix for a partially-run multi-group migration.
-- Use this if Supabase errors with:
-- ERROR: 42601: syntax error at or near "join"
--
-- In SQL Editor, replace the whole current query tab with this file.
-- Do not run only a selected fragment.

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
