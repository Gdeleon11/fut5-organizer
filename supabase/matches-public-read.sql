-- Allow public read access to matches (for guest registration)
-- Run this in Supabase SQL Editor

-- Drop existing select policy if it's too restrictive
DROP POLICY IF EXISTS "matches_select" ON public.matches;

-- Allow anyone (even unauthenticated) to read matches
CREATE POLICY "matches_public_read" ON public.matches
  FOR SELECT USING (true);
