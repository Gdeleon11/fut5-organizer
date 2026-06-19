-- STEP 1B: Create helper functions without dollar-quoted strings.
-- Run after group-step-1a-tables-columns.sql.

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as '
  select coalesce(
    exists (
      select 1
      from public.group_members
      where group_members.group_id = target_group_id
        and group_members.profile_id = auth.uid()
    ),
    false
  );
';

create or replace function public.is_group_active_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as '
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
';

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as '
  select coalesce(
    exists (
      select 1
      from public.group_members
      where group_members.group_id = target_group_id
        and group_members.profile_id = auth.uid()
        and group_members.role = ''admin''
    ),
    false
  );
';

create or replace function public.shares_group_with(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as '
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
';

create or replace function public.admin_for_profile_group(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as '
  select coalesce(
    exists (
      select 1
      from public.group_members admin_membership
      join public.group_members target_membership
        on target_membership.group_id = admin_membership.group_id
      where admin_membership.profile_id = auth.uid()
        and admin_membership.role = ''admin''
        and target_membership.profile_id = target_profile_id
    ),
    false
  );
';

select
  public.is_group_member(null::uuid) as member_function_ok,
  public.is_group_active_member(null::uuid) as active_member_function_ok,
  public.is_group_admin(null::uuid) as admin_function_ok;
