-- =============================================================================
-- Migration: Require Active Membership (is_active = true) for Group Data Access
--
-- Fixes premature read access by pending group joiners (is_active = false)
-- across all group-scoped tables, views, RPCs, and storage policies while
-- preserving:
--   1. Pending member's ability to read their own group_members row and basic
--      groups row (needed by listMyGroups / joinGroup onboarding flow).
--   2. Active members' normal read/write access to their own group.
--   3. Admins' ability to view and activate pending joiners (including their
--      profile name).
--   4. Approved Radar guests' explicit RPC-only access (unchanged).
--   5. Strict multi-group and anonymous isolation.
-- =============================================================================

BEGIN;

-- 1. Narrow helper for pending-or-active membership, used EXCLUSIVELY on
--    public.groups SELECT so a pending member can see the basic group record
--    for their own join request while awaiting admin activation.
CREATE OR REPLACE FUNCTION public.has_group_membership(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.profile_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.has_group_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_group_membership(uuid) TO authenticated;

-- 2. Harden public.is_group_member(target_group_id) to require active membership.
--    All group-scoped RLS policies and RPCs across Core, Finance, Championships,
--    Player Evolution, Radar, and Storage rely on this helper.
CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.profile_id = auth.uid()
      AND gm.is_active = true
  );
$$;

-- 3. Harden public.shares_group_with(target_profile_id) so pending members
--    cannot read other players' profiles or styles. Active admins retain read
--    access to pending joiners' profiles in their own group for activation.
CREATE OR REPLACE FUNCTION public.shares_group_with(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm_self
    JOIN public.group_members gm_other
      ON gm_self.group_id = gm_other.group_id
    WHERE gm_self.profile_id = auth.uid()
      AND gm_self.is_active = true
      AND gm_other.profile_id = target_profile_id
      AND (
        gm_other.is_active = true
        OR gm_self.role IN ('admin', 'super_admin')
      )
  );
$$;

-- 4. Keep basic groups SELECT working for pending members (their own join request).
DROP POLICY IF EXISTS "groups_select_member_or_owner" ON public.groups;
CREATE POLICY "groups_select_member_or_owner" ON public.groups
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_group_membership(id));

COMMIT;
