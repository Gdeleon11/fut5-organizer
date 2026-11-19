-- =============================================================================
-- Migration: Secure Public RPCs for Guest Registration, Court Reservations,
--            and Authenticated Group Search (Prerequisite before strict RLS)
-- =============================================================================

BEGIN;

-- Helper: safely parse either a 32-char hex token or canonical UUID string.
CREATE OR REPLACE FUNCTION public.parse_uuid_token(p_token text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_clean text;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  v_clean := btrim(p_token);
  IF v_clean ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v_clean::uuid;
  END IF;

  IF v_clean ~* '^[0-9a-f]{32}$' THEN
    RETURN (
      substr(v_clean, 1, 8) || '-' ||
      substr(v_clean, 9, 4) || '-' ||
      substr(v_clean, 13, 4) || '-' ||
      substr(v_clean, 17, 4) || '-' ||
      substr(v_clean, 21, 12)
    )::uuid;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.parse_uuid_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.parse_uuid_token(text) TO anon, authenticated;

-- 1. Public match summary for /guest/:token (minimal non-PII fields only)
CREATE OR REPLACE FUNCTION public.get_public_match_for_guest(p_token text)
RETURNS TABLE (
  id uuid,
  title text,
  match_date date,
  start_time text,
  venue text,
  max_players integer,
  status text,
  confirmed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_match_id uuid;
BEGIN
  v_match_id := public.parse_uuid_token(p_token);
  IF v_match_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.title,
    m.match_date,
    m.start_time,
    m.venue,
    m.max_players,
    m.status,
    (
      (SELECT count(*)::integer FROM public.attendances a WHERE a.match_id = m.id AND a.status IN ('confirmed', 'checked_in')) +
      (SELECT count(*)::integer FROM public.guest_players g WHERE g.match_id = m.id)
    ) AS confirmed_count
  FROM public.matches m
  WHERE m.id = v_match_id
    AND m.status = 'upcoming'
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_match_for_guest(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_match_for_guest(text) TO anon, authenticated;

-- 2. Register a guest for an upcoming match via /guest/:token
CREATE OR REPLACE FUNCTION public.register_guest_for_match(p_token text, p_name text)
RETURNS TABLE (
  id uuid,
  match_id uuid,
  name text,
  rating integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_group_id uuid;
  v_max_players integer;
  v_status text;
  v_current_count integer;
  v_clean_name text;
BEGIN
  v_match_id := public.parse_uuid_token(p_token);
  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Token de partido inválido.';
  END IF;

  v_clean_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF char_length(v_clean_name) < 2 OR char_length(v_clean_name) > 80 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 2 y 80 caracteres.';
  END IF;

  SELECT m.group_id, m.max_players, m.status
  INTO v_group_id, v_max_players, v_status
  FROM public.matches m
  WHERE m.id = v_match_id;

  IF NOT FOUND OR v_status <> 'upcoming' THEN
    RAISE EXCEPTION 'Partido no encontrado o cerrado para invitados.';
  END IF;

  SELECT
    (SELECT count(*)::integer FROM public.attendances a WHERE a.match_id = v_match_id AND a.status IN ('confirmed', 'checked_in')) +
    (SELECT count(*)::integer FROM public.guest_players g WHERE g.match_id = v_match_id)
  INTO v_current_count;

  IF v_max_players IS NOT NULL AND v_max_players > 0 AND v_current_count >= v_max_players THEN
    RAISE EXCEPTION 'El partido ya alcanzó el cupo máximo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.guest_players g
    WHERE g.match_id = v_match_id
      AND lower(btrim(g.name)) = lower(v_clean_name)
  ) THEN
    RAISE EXCEPTION 'Ya existe un invitado registrado con ese nombre en este partido.';
  END IF;

  RETURN QUERY
  INSERT INTO public.guest_players (match_id, group_id, name, rating)
  VALUES (v_match_id, v_group_id, v_clean_name, 2)
  RETURNING guest_players.id, guest_players.match_id, guest_players.name, guest_players.rating;
END;
$$;

REVOKE ALL ON FUNCTION public.register_guest_for_match(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_guest_for_match(text, text) TO anon, authenticated;

-- 3. Public reservation lookup for /reserve/:token (minimal non-PII fields)
CREATE OR REPLACE FUNCTION public.get_public_reservations_by_tokens(p_tokens text[])
RETURNS TABLE (
  id uuid,
  venue text,
  reservation_date date,
  reservation_time text,
  notes text,
  status text,
  proof_url text,
  assigned_display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_ids uuid[];
  v_first_group uuid;
  v_first_assignee uuid;
BEGIN
  IF p_tokens IS NULL OR array_length(p_tokens, 1) IS NULL OR array_length(p_tokens, 1) > 10 THEN
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT parsed)
  INTO v_ids
  FROM (
    SELECT public.parse_uuid_token(t) AS parsed
    FROM unnest(p_tokens) AS t
  ) s
  WHERE parsed IS NOT NULL;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT r.group_id, r.assigned_to
  INTO v_first_group, v_first_assignee
  FROM public.court_reservations r
  WHERE r.id = ANY(v_ids)
  ORDER BY r.reservation_date ASC
  LIMIT 1;

  IF v_first_group IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.venue,
    r.reservation_date,
    r.reservation_time,
    r.notes,
    r.status,
    r.proof_url,
    coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.full_name), ''), 'Jugador') AS assigned_display_name
  FROM public.court_reservations r
  LEFT JOIN public.profiles p ON p.id = r.assigned_to
  WHERE r.id = ANY(v_ids)
     OR (
       v_first_assignee IS NOT NULL
       AND r.group_id = v_first_group
       AND r.assigned_to = v_first_assignee
       AND r.status = 'pending'
     )
  ORDER BY r.reservation_date ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_reservations_by_tokens(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_reservations_by_tokens(text[]) TO anon, authenticated;

-- 4. Submit reservation proof via /reserve/:token (restricts update to proof_url only)
CREATE OR REPLACE FUNCTION public.submit_reservation_proof_by_token(p_token text, p_proof_url text)
RETURNS TABLE (
  id uuid,
  proof_url text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res_id uuid;
  v_clean_url text;
BEGIN
  v_res_id := public.parse_uuid_token(p_token);
  IF v_res_id IS NULL THEN
    RAISE EXCEPTION 'Token de reserva inválido.';
  END IF;

  v_clean_url := btrim(coalesce(p_proof_url, ''));
  IF v_clean_url = '' OR char_length(v_clean_url) > 1000 THEN
    RAISE EXCEPTION 'URL de comprobante inválida.';
  END IF;

  -- Restrict URL to Supabase Storage reservation-proofs bucket
  IF v_clean_url NOT LIKE '%/storage/v1/object/%/reservation-proofs/%' THEN
    RAISE EXCEPTION 'El comprobante debe provenir del almacenamiento oficial de reservas.';
  END IF;

  RETURN QUERY
  UPDATE public.court_reservations r
  SET proof_url = v_clean_url
  WHERE r.id = v_res_id
    AND r.status IN ('pending', 'confirmed')
  RETURNING r.id, r.proof_url, r.status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada o cancelada.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_reservation_proof_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_reservation_proof_by_token(text, text) TO anon, authenticated;

-- 5. Authenticated-only group discovery search (minimal public metadata, no member PII)
CREATE OR REPLACE FUNCTION public.search_groups_public(p_query text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_term text;
  v_uuid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida.';
  END IF;

  v_term := btrim(coalesce(p_query, ''));
  IF char_length(v_term) < 2 THEN
    RETURN;
  END IF;

  v_uuid := public.parse_uuid_token(v_term);
  IF v_uuid IS NOT NULL THEN
    RETURN QUERY
    SELECT g.id, g.name, g.description, g.created_at
    FROM public.groups g
    WHERE g.id = v_uuid
    LIMIT 5;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT g.id, g.name, g.description, g.created_at
  FROM public.groups g
  WHERE g.name ILIKE '%' || v_term || '%'
  ORDER BY g.created_at DESC
  LIMIT 8;
END;
$$;

REVOKE ALL ON FUNCTION public.search_groups_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_groups_public(text) TO authenticated;

COMMIT;
