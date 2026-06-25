-- Add description column to groups table
-- Run this in Supabase SQL Editor

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS description text;
