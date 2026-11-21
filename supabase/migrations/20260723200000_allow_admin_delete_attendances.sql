-- SUPERSEDED by 20261119104500_harden_rls_multigroup_and_finance (it drops and recreates these policies).
-- Marked as applied in Production history on 2026-11-21 (migration repair, no SQL executed).
-- Do not apply this file manually.
-- Applying it would add a GLOBAL is_admin() delete policy and break multi-group isolation.

drop policy if exists "attendances delete admin" on public.attendances;
create policy "attendances delete admin"
on public.attendances
for delete
to authenticated
using (public.is_admin());
