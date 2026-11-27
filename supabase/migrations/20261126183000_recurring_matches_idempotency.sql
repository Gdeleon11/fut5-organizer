-- =============================================================================
-- Migration: Recurring Matchday V1 — Atomic Idempotency & Series Tracking
--
-- Additive migration (safe for existing matches):
-- 1. Adds nullable `recurring_match_id` on `public.matches` with ON DELETE SET NULL
--    so canceling/deleting a recurring series preserves all already-generated matches.
-- 2. Adds a partial UNIQUE index on `(recurring_match_id, match_date)` where
--    `recurring_match_id IS NOT NULL` to guarantee zero duplicate generated matches
--    even under concurrent multi-admin loads, while keeping independent matches
--    (recurring_match_id IS NULL) and other recurrences completely separate.
-- =============================================================================

BEGIN;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS recurring_match_id uuid
  REFERENCES public.recurring_matches(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS matches_recurring_unique_date_idx
  ON public.matches (recurring_match_id, match_date)
  WHERE recurring_match_id IS NOT NULL;

COMMIT;
