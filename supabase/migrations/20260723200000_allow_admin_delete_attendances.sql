drop policy if exists "attendances delete admin" on public.attendances;
create policy "attendances delete admin"
on public.attendances
for delete
to authenticated
using (public.is_admin());
