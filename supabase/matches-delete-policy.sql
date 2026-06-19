-- Allow group admins and super_admins to delete matches in their group.
-- Deleting a match cascades to: attendances, teams, team_members, match_fees,
-- match_fee_payments (all have ON DELETE CASCADE).

drop policy if exists "matches delete admin" on public.matches;

create policy "matches delete admin"
on public.matches
for delete
to authenticated
using (public.is_group_admin(group_id) or public.is_group_super_admin(group_id));
