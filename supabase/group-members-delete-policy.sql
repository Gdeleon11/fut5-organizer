-- Allow group admins and super_admins to remove members from their group.
-- A super_admin cannot remove themselves (frontend enforces this too).

drop policy if exists "group members delete admin" on public.group_members;

create policy "group members delete admin"
on public.group_members
for delete
to authenticated
using (
  public.is_group_admin(group_id)
  and profile_id <> auth.uid()  -- can't remove yourself
);
