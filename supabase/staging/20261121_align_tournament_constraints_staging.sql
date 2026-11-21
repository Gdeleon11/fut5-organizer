-- =============================================================================
-- STAGING ONLY (Chamusca-Staging). Do NOT run on Production: Production already
-- has every constraint below (verified read-only on 2026-11-21).
--
-- Why: staging's tournament tables drifted from Production when they were
-- recreated. The missing foreign keys make the app's PostgREST embeds fail:
--   GET tournament_matches?select=*,home_team:tournament_teams!home_team_id(*)
--   GET tournament_standings?select=*,tournament_team:tournament_teams(*)
--   → 400 PGRST200 "Could not find a relationship between ... in the schema cache"
-- The same queries return 200 on Production.
--
-- What: adds the exact Production definitions (FKs, CHECKs, NOT NULLs) only when
-- missing. Verified beforehand: staging tournament tables had 0 rows, 0 orphans,
-- 0 invalid statuses/formats. Nothing is dropped; RLS policies are untouched
-- (identical to Production).
-- =============================================================================

BEGIN;

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('tournament_matches', 'tournament_matches_home_team_id_fkey', 'FOREIGN KEY (home_team_id) REFERENCES public.tournament_teams(id) ON DELETE SET NULL'),
    ('tournament_matches', 'tournament_matches_away_team_id_fkey', 'FOREIGN KEY (away_team_id) REFERENCES public.tournament_teams(id) ON DELETE SET NULL'),
    ('tournament_matches', 'tournament_matches_match_id_fkey', 'FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL'),
    ('tournament_matches', 'tournament_matches_status_check', 'CHECK (status = ANY (ARRAY[''pending''::text, ''played''::text, ''canceled''::text]))'),
    ('tournament_standings', 'tournament_standings_tournament_team_id_fkey', 'FOREIGN KEY (tournament_team_id) REFERENCES public.tournament_teams(id) ON DELETE CASCADE'),
    ('tournaments', 'tournaments_format_check', 'CHECK (format = ANY (ARRAY[''cuadrangular''::text, ''league''::text, ''league_playoffs''::text, ''playoffs_only''::text]))'),
    ('tournaments', 'tournaments_status_check', 'CHECK (status = ANY (ARRAY[''draft''::text, ''active''::text, ''finished''::text]))')
  ) AS v(tbl, name, def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name AND conrelid = ('public.' || c.tbl)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', c.tbl, c.name, c.def);
    END IF;
  END LOOP;
END $$;

-- NOT NULL columns that are NOT NULL on Production (safe: no NULL rows in staging).
ALTER TABLE public.tournaments ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.tournaments ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.tournament_teams ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.tournament_teams ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.tournament_team_members ALTER COLUMN tournament_team_id SET NOT NULL;
ALTER TABLE public.tournament_team_members ALTER COLUMN profile_id SET NOT NULL;
ALTER TABLE public.tournament_matches ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.tournament_standings ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.tournament_standings ALTER COLUMN points SET NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
