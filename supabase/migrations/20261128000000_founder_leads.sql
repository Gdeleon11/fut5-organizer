-- =============================================================================
-- Migration: Commercial Launch V1 — Founder Leads, Commercial Operators,
--            Persistent Public Rate Limiting & Funnel Analytics Events
-- Safe & idempotent for Staging. NOT to be applied to Production until GO.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Commercial Operators (explicit allowlist, decoupled from legacy is_admin
--    and sports group_members admin roles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_operators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_operators ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.commercial_operators FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commercial_operators TO service_role;

CREATE OR REPLACE FUNCTION public.is_commercial_operator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commercial_operators co
    WHERE co.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_commercial_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_commercial_operator() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Founder Leads (server-side ingestion via /api/founder-leads only;
--    no public INSERT, SELECT, UPDATE, or DELETE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.founder_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL CHECK (char_length(trim(contact_name)) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (char_length(trim(email)) BETWEEN 5 AND 254 AND position('@' IN email) > 1),
  city text NOT NULL CHECK (char_length(trim(city)) BETWEEN 2 AND 120),
  group_frequency text NOT NULL CHECK (group_frequency IN ('semanal', 'quincenal', 'mensual', 'ocasional')),
  group_size text NOT NULL CHECK (group_size IN ('5-9', '10-14', '15-22', '23+')),
  consent boolean NOT NULL CHECK (consent = true),
  source text NOT NULL DEFAULT 'landing' CHECK (source IN ('landing', 'features', 'faq', 'direct')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'onboarded', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS founder_leads_status_idx ON public.founder_leads(status);
CREATE INDEX IF NOT EXISTS founder_leads_created_at_idx ON public.founder_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS founder_leads_email_lower_idx ON public.founder_leads(lower(email));

ALTER TABLE public.founder_leads ENABLE ROW LEVEL SECURITY;

-- Remove any previous public/legacy policies
DROP POLICY IF EXISTS "founder_leads insert public" ON public.founder_leads;
DROP POLICY IF EXISTS "founder_leads select admin" ON public.founder_leads;
DROP POLICY IF EXISTS "founder_leads update admin" ON public.founder_leads;
DROP POLICY IF EXISTS "founder_leads select commercial operator" ON public.founder_leads;
DROP POLICY IF EXISTS "founder_leads update commercial operator" ON public.founder_leads;

-- Strict table-level privileges: anon has ZERO privileges; authenticated can
-- only SELECT/UPDATE if matched by commercial_operators RLS; DELETE denied.
REVOKE ALL ON TABLE public.founder_leads FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.founder_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.founder_leads TO service_role;

CREATE POLICY "founder_leads select commercial operator"
  ON public.founder_leads
  FOR SELECT
  TO authenticated
  USING (public.is_commercial_operator());

CREATE POLICY "founder_leads update commercial operator"
  ON public.founder_leads
  FOR UPDATE
  TO authenticated
  USING (public.is_commercial_operator())
  WITH CHECK (public.is_commercial_operator());

-- ---------------------------------------------------------------------------
-- 3. Persistent Atomic Rate Limiting for Public Commercial Endpoints
--    (/api/founder-leads & /api/analytics/events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_api_rate_limits (
  scope_key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_public_api_rate_limits_window_start
  ON public.public_api_rate_limits (window_start);

ALTER TABLE public.public_api_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_public_rate_limit(
  p_scope_key text,
  p_limit integer DEFAULT 5,
  p_window_seconds integer DEFAULT 3600
)
RETURNS TABLE (
  allowed boolean,
  current_count integer,
  limit_val integer,
  retry_after_sec integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_sec integer := GREATEST(60, LEAST(86400, coalesce(p_window_seconds, 3600)));
  v_limit integer := GREATEST(1, LEAST(10000, coalesce(p_limit, 5)));
  v_bucket_epoch bigint := floor(extract(epoch FROM v_now) / v_window_sec)::bigint * v_window_sec;
  v_window_start timestamptz := to_timestamp(v_bucket_epoch);
  v_retry_after integer := GREATEST(1, (v_bucket_epoch + v_window_sec - floor(extract(epoch FROM v_now))::bigint)::integer);
  v_count integer;
BEGIN
  IF p_scope_key IS NULL OR char_length(trim(p_scope_key)) = 0 THEN
    RAISE EXCEPTION 'p_scope_key is required';
  END IF;

  -- Prune stale buckets older than 48 hours
  DELETE FROM public.public_api_rate_limits
  WHERE window_start < v_now - interval '48 hours';

  -- Atomic upsert (serializes concurrent requests on same PK)
  INSERT INTO public.public_api_rate_limits (scope_key, window_start, request_count, updated_at)
  VALUES (p_scope_key, v_window_start, 1, v_now)
  ON CONFLICT (scope_key, window_start)
  DO UPDATE SET
    request_count = public.public_api_rate_limits.request_count + 1,
    updated_at = v_now
  RETURNING public.public_api_rate_limits.request_count INTO v_count;

  IF v_count > v_limit THEN
    RETURN QUERY SELECT false, v_count, v_limit, v_retry_after;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_count, v_limit, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_rate_limit(text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Funnel Analytics Events (PII-free, strict whitelist, deduplicated)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL CHECK (event_name IN (
    'landing_view',
    'signup_start',
    'signup_complete',
    'group_created',
    'first_match_created',
    'invite_shared',
    'first_player_confirmed',
    'first_match_completed',
    'founders_interest_submitted'
  )),
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64),
  dedupe_key text CHECK (dedupe_key IS NULL OR char_length(dedupe_key) <= 120),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  trust_level text NOT NULL DEFAULT 'client_reported' CHECK (trust_level IN ('client_reported', 'server_verified')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx
  ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx
  ON public.analytics_events (session_id);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_dedupe_uidx
  ON public.analytics_events (event_name, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events select commercial operator" ON public.analytics_events;

REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.analytics_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_events TO service_role;

CREATE POLICY "analytics_events select commercial operator"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (public.is_commercial_operator());

COMMIT;
