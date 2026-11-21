-- SUPERSEDED by 20261119104500_harden_rls_multigroup_and_finance (it drops and recreates these policies).
-- Marked as applied in Production history on 2026-11-21 (migration repair, no SQL executed).
-- Do not apply this file manually.

-- Ensure RLS is enabled on the table
ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;

-- Recreate policy to allow active players to manage their own statistics
DROP POLICY IF EXISTS "Permitir a jugadores gestionar sus propias estadísticas" ON public.match_player_stats;

CREATE POLICY "Permitir a jugadores gestionar sus propias estadísticas"
  ON public.match_player_stats FOR ALL
  TO authenticated
  USING (
    auth.uid() = player_id AND public.is_group_member(group_id)
  )
  WITH CHECK (
    auth.uid() = player_id AND public.is_group_member(group_id)
  );
