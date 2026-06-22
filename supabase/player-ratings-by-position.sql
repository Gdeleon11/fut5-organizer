-- Migration: Add position-specific ratings to player_ratings
-- Run this in Supabase SQL Editor

-- Step 1: Add columns WITHOUT check constraints first
ALTER TABLE public.player_ratings
  ADD COLUMN IF NOT EXISTS attack_rating integer,
  ADD COLUMN IF NOT EXISTS defense_rating integer,
  ADD COLUMN IF NOT EXISTS midfield_rating integer,
  ADD COLUMN IF NOT EXISTS goalkeeper_rating integer;

-- Step 2: Migrate existing ratings, clamping to 1-4 range
-- Handles both NULL and 0 values
UPDATE public.player_ratings
SET
  attack_rating = GREATEST(1, LEAST(4, COALESCE(NULLIF(attack_rating, 0), rating))),
  defense_rating = GREATEST(1, LEAST(4, COALESCE(NULLIF(defense_rating, 0), rating))),
  midfield_rating = GREATEST(1, LEAST(4, COALESCE(NULLIF(midfield_rating, 0), rating))),
  goalkeeper_rating = GREATEST(1, LEAST(4, COALESCE(NULLIF(goalkeeper_rating, 0), rating)))
WHERE attack_rating IS NULL OR attack_rating = 0;

-- Step 3: Now add the check constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_ratings_attack_rating_check') THEN
    ALTER TABLE public.player_ratings ADD CONSTRAINT player_ratings_attack_rating_check CHECK (attack_rating BETWEEN 1 AND 4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_ratings_defense_rating_check') THEN
    ALTER TABLE public.player_ratings ADD CONSTRAINT player_ratings_defense_rating_check CHECK (defense_rating BETWEEN 1 AND 4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_ratings_midfield_rating_check') THEN
    ALTER TABLE public.player_ratings ADD CONSTRAINT player_ratings_midfield_rating_check CHECK (midfield_rating BETWEEN 1 AND 4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_ratings_goalkeeper_rating_check') THEN
    ALTER TABLE public.player_ratings ADD CONSTRAINT player_ratings_goalkeeper_rating_check CHECK (goalkeeper_rating BETWEEN 1 AND 4);
  END IF;
END $$;
