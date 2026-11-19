-- =============================================================================
-- Migration: Distributed Atomic Rate Limiting for /api/llm-proxy
--            Works across concurrent Vercel serverless instances via Postgres
--            row-level locking (INSERT ... ON CONFLICT DO UPDATE).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.llm_rate_limits (
  scope_key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_llm_rate_limits_window_start
  ON public.llm_rate_limits (window_start);

-- Lock table completely: no anon or authenticated policies (service_role only)
ALTER TABLE public.llm_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.llm_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.llm_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_llm_rate_limit(
  p_user_id uuid,
  p_group_id uuid,
  p_user_limit integer DEFAULT 10,
  p_group_limit integer DEFAULT 25,
  p_window_seconds integer DEFAULT 600
)
RETURNS TABLE (
  allowed boolean,
  blocked_scope text,
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
  v_window_sec integer := GREATEST(60, LEAST(86400, coalesce(p_window_seconds, 600)));
  v_bucket_epoch bigint := floor(extract(epoch FROM v_now) / v_window_sec)::bigint * v_window_sec;
  v_window_start timestamptz := to_timestamp(v_bucket_epoch);
  v_retry_after integer := GREATEST(1, (v_bucket_epoch + v_window_sec - floor(extract(epoch FROM v_now))::bigint)::integer);
  v_user_key text := 'user:' || p_user_id::text;
  v_group_key text := 'group:' || p_group_id::text;
  v_user_count integer;
  v_group_count integer;
BEGIN
  IF p_user_id IS NULL OR p_group_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id and p_group_id are required';
  END IF;

  -- Prune stale buckets opportunistically (> 24h old)
  DELETE FROM public.llm_rate_limits
  WHERE window_start < v_now - interval '24 hours';

  -- Atomic upsert for user scope (serializes concurrent requests on same PK)
  INSERT INTO public.llm_rate_limits (scope_key, window_start, request_count, updated_at)
  VALUES (v_user_key, v_window_start, 1, v_now)
  ON CONFLICT (scope_key, window_start)
  DO UPDATE SET
    request_count = public.llm_rate_limits.request_count + 1,
    updated_at = v_now
  RETURNING public.llm_rate_limits.request_count INTO v_user_count;

  IF v_user_count > p_user_limit THEN
    RETURN QUERY SELECT false, 'user'::text, v_user_count, p_user_limit, v_retry_after;
    RETURN;
  END IF;

  -- Atomic upsert for group scope
  INSERT INTO public.llm_rate_limits (scope_key, window_start, request_count, updated_at)
  VALUES (v_group_key, v_window_start, 1, v_now)
  ON CONFLICT (scope_key, window_start)
  DO UPDATE SET
    request_count = public.llm_rate_limits.request_count + 1,
    updated_at = v_now
  RETURNING public.llm_rate_limits.request_count INTO v_group_count;

  IF v_group_count > p_group_limit THEN
    RETURN QUERY SELECT false, 'group'::text, v_group_count, p_group_limit, v_retry_after;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, v_user_count, p_user_limit, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_llm_rate_limit(uuid, uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_llm_rate_limit(uuid, uuid, integer, integer, integer) TO service_role;

COMMIT;
