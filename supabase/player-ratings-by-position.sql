-- Migration: Add position-specific ratings to player_ratings
-- Run this in Supabase SQL Editor

ALTER TABLE public.player_ratings
  ADD COLUMN IF NOT EXISTS attack_rating integer CHECK (attack_rating BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS defense_rating integer CHECK (defense_rating BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS midfield_rating integer CHECK (midfield_rating BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS goalkeeper_rating integer CHECK (goalkeeper_rating BETWEEN 1 AND 4);

-- Migrate existing overall ratings to all position columns as defaults
UPDATE public.player_ratings
SET
  attack_rating = rating,
  defense_rating = rating,
  midfield_rating = rating,
  goalkeeper_rating = rating
WHERE attack_rating IS NULL;
