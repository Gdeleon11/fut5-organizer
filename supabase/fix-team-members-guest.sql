-- Fix team_members to support guest players
-- Run this in Supabase SQL Editor

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS guest_player_id uuid REFERENCES public.guest_players(id) ON DELETE CASCADE;

-- Make profile_id nullable (for guest rows)
ALTER TABLE public.team_members
  ALTER COLUMN profile_id DROP NOT NULL;
