-- =============================================================================
-- Migration: Harden Multi-Group RLS, Role Isolation, and Financial Integrity
--            across all 30 public tables (Transactional, no USING (true) leaks)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Canonical SECURITY DEFINER authorization helpers (controlled search_path)
-- -----------------------------------------------------------------------------

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
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_group_member(target_group_id uuid)
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

CREATE OR REPLACE FUNCTION public.is_group_admin(target_group_id uuid)
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
      AND gm.role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_super_admin(target_group_id uuid)
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
      AND gm.role = 'super_admin'
  );
$$;

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
      AND gm_other.profile_id = target_profile_id
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_for_profile_group(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm_admin
    JOIN public.group_members gm_target
      ON gm_admin.group_id = gm_target.group_id
    WHERE gm_admin.profile_id = auth.uid()
      AND gm_admin.is_active = true
      AND gm_admin.role IN ('admin', 'super_admin')
      AND gm_target.profile_id = target_profile_id
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Trigger preventing non-admins from self-approving payments
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_payment_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role / migrations with no auth.uid()
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_group_admin(OLD.group_id) THEN
    -- Regular players may ONLY submit/update proof_url and set proof_status = 'submitted'
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
       OR NEW.proof_reviewed_at IS DISTINCT FROM OLD.proof_reviewed_at
       OR NEW.proof_rejection_reason IS DISTINCT FROM OLD.proof_rejection_reason
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
    THEN
      RAISE EXCEPTION 'Solo un administrador del grupo puede aprobar o modificar el estado del pago.';
    END IF;

    IF NEW.proof_status IS DISTINCT FROM OLD.proof_status
       AND NEW.proof_status IS NOT NULL
       AND NEW.proof_status <> 'submitted'
    THEN
      RAISE EXCEPTION 'Solo un administrador del grupo puede aprobar o rechazar comprobantes.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_match_fee_payment_admin_fields ON public.match_fee_payments;
CREATE TRIGGER protect_match_fee_payment_admin_fields
BEFORE UPDATE ON public.match_fee_payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_admin_fields();

DROP TRIGGER IF EXISTS protect_collection_payment_admin_fields ON public.collection_payments;
CREATE TRIGGER protect_collection_payment_admin_fields
BEFORE UPDATE ON public.collection_payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_admin_fields();

-- -----------------------------------------------------------------------------
-- 3. Drop ALL existing policies on the 30 public tables (removes USING (true))
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  pol record;
  target_tables text[] := ARRAY[
    'profiles', 'groups', 'group_members', 'group_tags', 'settings',
    'venues', 'matches', 'attendances', 'guest_players', 'recurring_matches',
    'teams', 'team_members', 'player_ratings', 'player_skills', 'player_votes',
    'fines', 'match_fees', 'match_fee_payments', 'collections', 'collection_payments',
    'group_expenses', 'court_reservations', 'match_player_stats', 'match_stats',
    'tournaments', 'tournament_teams', 'tournament_team_members',
    'tournament_matches', 'tournament_standings', 'push_subscriptions'
  ];
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(target_tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Ensure RLS is enabled on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Strict Multi-Group RLS Policies (TO authenticated ONLY)
-- -----------------------------------------------------------------------------

-- profiles
CREATE POLICY "profiles_select_own_or_shared_group" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_group_with(id));

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own_or_group_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.admin_for_profile_group(id))
  WITH CHECK (id = auth.uid() OR public.admin_for_profile_group(id));

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid());

-- groups
CREATE POLICY "groups_select_member_or_owner" ON public.groups
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_group_member(id));

CREATE POLICY "groups_insert_owner" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "groups_update_admin" ON public.groups
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(id))
  WITH CHECK (public.is_group_admin(id));

CREATE POLICY "groups_delete_super_admin_or_owner" ON public.groups
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_group_super_admin(id));

-- group_members (prevents self-promotion to admin/super_admin)
CREATE POLICY "group_members_select_member" ON public.group_members
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_group_member(group_id));

CREATE POLICY "group_members_insert_controlled" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Join request as inactive player
    (profile_id = auth.uid() AND role = 'player' AND is_active = false)
    OR
    -- Group creator bootstrapping themselves as super_admin
    (
      profile_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
      AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
    )
    OR
    -- Existing group admin adding a member
    public.is_group_admin(group_id)
  );

CREATE POLICY "group_members_update_admin_only" ON public.group_members
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (
    public.is_group_super_admin(group_id)
    OR (public.is_group_admin(group_id) AND role <> 'super_admin')
  );

CREATE POLICY "group_members_delete_admin_or_self" ON public.group_members
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid() OR public.is_group_admin(group_id));

-- group_tags
CREATE POLICY "group_tags_select_member" ON public.group_tags
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "group_tags_insert_admin" ON public.group_tags
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "group_tags_delete_admin" ON public.group_tags
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- settings
CREATE POLICY "settings_select_member" ON public.settings
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "settings_insert_admin" ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "settings_update_admin" ON public.settings
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "settings_delete_super_admin" ON public.settings
  FOR DELETE TO authenticated
  USING (public.is_group_super_admin(group_id));

-- venues
CREATE POLICY "venues_select_member" ON public.venues
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "venues_insert_admin" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "venues_update_admin" ON public.venues
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "venues_delete_admin" ON public.venues
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- matches (public guest read goes exclusively through get_public_match_for_guest RPC)
CREATE POLICY "matches_select_member" ON public.matches
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "matches_insert_admin" ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "matches_update_admin" ON public.matches
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "matches_delete_admin" ON public.matches
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- attendances
CREATE POLICY "attendances_select_member" ON public.attendances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = attendances.match_id
        AND public.is_group_member(m.group_id)
    )
  );

CREATE POLICY "attendances_insert_active_self_or_admin" ON public.attendances
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = attendances.match_id
        AND (
          public.is_group_admin(m.group_id)
          OR (
            attendances.profile_id = auth.uid()
            AND attendances.status IN ('confirmed', 'waitlist')
            AND attendances.checked_in = false
            AND public.is_active_group_member(m.group_id)
          )
        )
    )
  );

CREATE POLICY "attendances_update_self_or_admin" ON public.attendances
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = attendances.match_id
        AND (
          public.is_group_admin(m.group_id)
          OR (attendances.profile_id = auth.uid() AND public.is_active_group_member(m.group_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = attendances.match_id
        AND (
          public.is_group_admin(m.group_id)
          OR (
            attendances.profile_id = auth.uid()
            AND attendances.status IN ('confirmed', 'canceled', 'waitlist')
            AND attendances.checked_in = false
            AND public.is_active_group_member(m.group_id)
          )
        )
    )
  );

CREATE POLICY "attendances_delete_admin" ON public.attendances
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = attendances.match_id
        AND public.is_group_admin(m.group_id)
    )
  );

-- guest_players (public guest insert goes exclusively through register_guest_for_match RPC)
CREATE POLICY "guest_players_select_member" ON public.guest_players
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "guest_players_insert_admin" ON public.guest_players
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "guest_players_update_admin" ON public.guest_players
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "guest_players_delete_admin" ON public.guest_players
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- recurring_matches
CREATE POLICY "recurring_matches_select_member" ON public.recurring_matches
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "recurring_matches_manage_admin" ON public.recurring_matches
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

-- teams
CREATE POLICY "teams_select_member" ON public.teams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = teams.match_id
        AND public.is_group_member(m.group_id)
    )
  );

CREATE POLICY "teams_manage_admin" ON public.teams
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = teams.match_id
        AND public.is_group_admin(m.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = teams.match_id
        AND public.is_group_admin(m.group_id)
    )
  );

-- team_members (migrated from legacy is_admin() to group-scoped is_group_admin())
CREATE POLICY "team_members_select_member" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.matches m ON m.id = t.match_id
      WHERE t.id = team_members.team_id
        AND public.is_group_member(m.group_id)
    )
  );

CREATE POLICY "team_members_manage_admin" ON public.team_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.matches m ON m.id = t.match_id
      WHERE t.id = team_members.team_id
        AND public.is_group_admin(m.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.matches m ON m.id = t.match_id
      WHERE t.id = team_members.team_id
        AND public.is_group_admin(m.group_id)
    )
  );

-- player_ratings
CREATE POLICY "player_ratings_select_member" ON public.player_ratings
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "player_ratings_insert_admin" ON public.player_ratings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id) AND assigned_by = auth.uid());

CREATE POLICY "player_ratings_update_admin" ON public.player_ratings
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "player_ratings_delete_admin" ON public.player_ratings
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- player_skills
CREATE POLICY "player_skills_select_member" ON public.player_skills
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "player_skills_manage_admin" ON public.player_skills
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

-- player_votes
CREATE POLICY "player_votes_select_member" ON public.player_votes
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "player_votes_insert_self_member" ON public.player_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND voted_id <> auth.uid()
    AND public.is_active_group_member(group_id)
  );

CREATE POLICY "player_votes_update_self_member" ON public.player_votes
  FOR UPDATE TO authenticated
  USING (voter_id = auth.uid() AND public.is_group_member(group_id))
  WITH CHECK (voter_id = auth.uid() AND voted_id <> auth.uid() AND public.is_group_member(group_id));

CREATE POLICY "player_votes_delete_self_or_admin" ON public.player_votes
  FOR DELETE TO authenticated
  USING (voter_id = auth.uid() OR public.is_group_admin(group_id));

-- fines (strict financial isolation)
CREATE POLICY "fines_select_own_or_admin" ON public.fines
  FOR SELECT TO authenticated
  USING (
    (profile_id = auth.uid() AND public.is_group_member(group_id))
    OR public.is_group_admin(group_id)
  );

CREATE POLICY "fines_insert_admin_or_late_cancel_self" ON public.fines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_admin(group_id)
    OR (
      profile_id = auth.uid()
      AND reason = 'late_cancel'
      AND status = 'open'
      AND public.is_active_group_member(group_id)
    )
  );

CREATE POLICY "fines_update_admin" ON public.fines
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "fines_delete_admin" ON public.fines
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- match_fees & match_fee_payments
CREATE POLICY "match_fees_select_member" ON public.match_fees
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "match_fees_manage_admin" ON public.match_fees
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "match_fee_payments_select_own_or_admin" ON public.match_fee_payments
  FOR SELECT TO authenticated
  USING (
    (profile_id = auth.uid() AND public.is_group_member(group_id))
    OR public.is_group_admin(group_id)
  );

CREATE POLICY "match_fee_payments_insert_admin" ON public.match_fee_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "match_fee_payments_update_own_proof_or_admin" ON public.match_fee_payments
  FOR UPDATE TO authenticated
  USING (
    (profile_id = auth.uid() AND public.is_group_member(group_id))
    OR public.is_group_admin(group_id)
  )
  WITH CHECK (
    (profile_id = auth.uid() AND public.is_group_member(group_id))
    OR public.is_group_admin(group_id)
  );

CREATE POLICY "match_fee_payments_delete_admin" ON public.match_fee_payments
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- collections & collection_payments
CREATE POLICY "collections_select_member" ON public.collections
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "collections_manage_admin" ON public.collections
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "collection_payments_select_own_or_admin" ON public.collection_payments
  FOR SELECT TO authenticated
  USING (
    (profile_id = auth.uid() AND public.is_group_member(group_id))
    OR public.is_group_admin(group_id)
  );

CREATE POLICY "collection_payments_insert_admin" ON public.collection_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "collection_payments_update_own_proof_or_admin" ON public.collection_payments
  FOR UPDATE TO authenticated
  USING (
    (profile_id = auth.uid() AND public.is_group_member(group_id))
    OR public.is_group_admin(group_id)
  )
  WITH CHECK (
    (profile_id = auth.uid() AND public.is_group_member(group_id))
    OR public.is_group_admin(group_id)
  );

CREATE POLICY "collection_payments_delete_admin" ON public.collection_payments
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- group_expenses
CREATE POLICY "group_expenses_select_member" ON public.group_expenses
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "group_expenses_manage_admin" ON public.group_expenses
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

-- court_reservations (public proof upload uses submit_reservation_proof_by_token RPC)
CREATE POLICY "court_reservations_select_member" ON public.court_reservations
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "court_reservations_insert_admin" ON public.court_reservations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "court_reservations_update_admin_or_assignee" ON public.court_reservations
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id) OR (assigned_to = auth.uid() AND public.is_group_member(group_id)))
  WITH CHECK (public.is_group_admin(group_id) OR (assigned_to = auth.uid() AND public.is_group_member(group_id)));

CREATE POLICY "court_reservations_delete_admin" ON public.court_reservations
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

-- match_player_stats
CREATE POLICY "match_player_stats_select_member" ON public.match_player_stats
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "match_player_stats_manage_own" ON public.match_player_stats
  FOR ALL TO authenticated
  USING (player_id = auth.uid() AND public.is_group_member(group_id))
  WITH CHECK (player_id = auth.uid() AND public.is_group_member(group_id));

CREATE POLICY "match_player_stats_manage_admin" ON public.match_player_stats
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

-- match_stats (legacy table, locked to group members/admins via match_id)
CREATE POLICY "match_stats_select_member" ON public.match_stats
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_stats.match_id
        AND public.is_group_member(m.group_id)
    )
  );

CREATE POLICY "match_stats_manage_admin" ON public.match_stats
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_stats.match_id
        AND public.is_group_admin(m.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_stats.match_id
        AND public.is_group_admin(m.group_id)
    )
  );

-- tournaments & related tables
CREATE POLICY "tournaments_select_member" ON public.tournaments
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "tournaments_manage_admin" ON public.tournaments
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "tournament_teams_select_member" ON public.tournament_teams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_teams.tournament_id
        AND public.is_group_member(t.group_id)
    )
  );

CREATE POLICY "tournament_teams_manage_admin" ON public.tournament_teams
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_teams.tournament_id
        AND public.is_group_admin(t.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_teams.tournament_id
        AND public.is_group_admin(t.group_id)
    )
  );

CREATE POLICY "tournament_team_members_select_member" ON public.tournament_team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_teams tt
      JOIN public.tournaments t ON t.id = tt.tournament_id
      WHERE tt.id = tournament_team_members.tournament_team_id
        AND public.is_group_member(t.group_id)
    )
  );

CREATE POLICY "tournament_team_members_manage_admin" ON public.tournament_team_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_teams tt
      JOIN public.tournaments t ON t.id = tt.tournament_id
      WHERE tt.id = tournament_team_members.tournament_team_id
        AND public.is_group_admin(t.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tournament_teams tt
      JOIN public.tournaments t ON t.id = tt.tournament_id
      WHERE tt.id = tournament_team_members.tournament_team_id
        AND public.is_group_admin(t.group_id)
    )
  );

CREATE POLICY "tournament_matches_select_member" ON public.tournament_matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_matches.tournament_id
        AND public.is_group_member(t.group_id)
    )
  );

CREATE POLICY "tournament_matches_manage_admin" ON public.tournament_matches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_matches.tournament_id
        AND public.is_group_admin(t.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_matches.tournament_id
        AND public.is_group_admin(t.group_id)
    )
  );

CREATE POLICY "tournament_standings_select_member" ON public.tournament_standings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_standings.tournament_id
        AND public.is_group_member(t.group_id)
    )
  );

CREATE POLICY "tournament_standings_manage_admin" ON public.tournament_standings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_standings.tournament_id
        AND public.is_group_admin(t.group_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_standings.tournament_id
        AND public.is_group_admin(t.group_id)
    )
  );

-- push_subscriptions (admins may ONLY read subscriptions of members in groups they administer)
CREATE POLICY "push_subscriptions_manage_own" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "push_subscriptions_select_same_group_admin" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (public.admin_for_profile_group(profile_id));

COMMIT;
