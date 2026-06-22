-- Add missing columns to matches table
-- Run this in Supabase SQL Editor

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS court_photo_url text,
  ADD COLUMN IF NOT EXISTS min_players integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_players integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS court_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS venue_id uuid;
