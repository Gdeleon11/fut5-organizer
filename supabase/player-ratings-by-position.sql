-- Migration: Add position-specific ratings to player_ratings
-- Run this in Supabase SQL Editor

-- Step 1: Add columns WITHOUT check constraints first
ALTER TABLE public.player_ratings
  ADD COLUMN IF NOT EXISTS attack_rating integer,
  ADD COLUMN IF NOT EXISTS defense_rating integer,
  ADD COLUMN IF NOT EXISTS midfield_rating integer,
  ADD COLUMN IF NOT EXISTS goalkeeper_rating integer;

-- Step 2: Migrate existing ratings, clamping to 1-4 range
UPDATE public.player_ratings
SET
  attack_rating = GREATEST(1, LEAST(4, rating)),
  defense_rating = GREATEST(1, LEAST(4, rating)),
  midfield_rating = GREATEST(1, LEAST(4, rating)),
  goalkeeper_rating = GREATEST(1, LEAST(4, rating))
WHERE attack_rating IS NULL;

-- Step 3: Now add the check constraints
ALTER TABLE public.player_ratings
  ADD CONSTRAINT player_ratings_attack_rating_check CHECK (attack_rating BETWEEN 1 AND 4),
  ADD CONSTRAINT player_ratings_defense_rating_check CHECK (defense_rating BETWEEN 1 AND 4),
  ADD CONSTRAINT player_ratings_midfield_rating_check CHECK (midfield_rating BETWEEN 1 AND 4),
  ADD CONSTRAINT player_ratings_goalkeeper_rating_check CHECK (goalkeeper_rating BETWEEN 1 AND 4);
