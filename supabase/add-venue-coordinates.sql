-- Add coordinates to venues table
-- Run this in Supabase SQL Editor

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;
