-- Fix matches status check constraint
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing constraint
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;

-- Step 2: Update any invalid status values
UPDATE public.matches SET status = 'upcoming'
WHERE status NOT IN ('upcoming', 'closed', 'canceled');

-- Step 3: Re-add the constraint
ALTER TABLE public.matches
  ADD CONSTRAINT matches_status_check CHECK (status IN ('upcoming', 'closed', 'canceled'));
