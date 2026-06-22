-- Fix invalid status values in matches table
-- Run this in Supabase SQL Editor

-- First, see what invalid statuses exist (run this to check):
-- SELECT DISTINCT status FROM public.matches WHERE status NOT IN ('upcoming', 'closed', 'canceled');

-- Fix invalid status values
UPDATE public.matches
SET status = 'upcoming'
WHERE status NOT IN ('upcoming', 'closed', 'canceled');

-- Also add the constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_status_check') THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_status_check CHECK (status IN ('upcoming', 'closed', 'canceled'));
  END IF;
END $$;
