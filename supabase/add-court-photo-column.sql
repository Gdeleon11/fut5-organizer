-- Add court_photo_url column to matches table
-- Run this in Supabase SQL Editor

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS court_photo_url text;
