-- =============================================================================
-- Migration: F5 Radar MVP 1.0
--
-- Plan: docs/F5_RADAR_MVP_PLAN.md
--
-- What: additive only. New tables (radar_group_settings, radar_listings,
--       radar_requests, radar_match_access, radar_group_bans, app_notifications),
--       their RLS policies, SECURITY DEFINER RPCs, three triggers that only act on
--       matches that have a Radar listing, and a membership guard for Radar players.
--
-- Not touched: every existing table, column, constraint and policy. Every
--       existing match stays private (no listing rows exist).
--
-- Safety rules encoded here:
--   * outsiders never read existing tables directly; they only get the fixed safe
--     columns returned by the radar_* RPCs (never matches.id, group_id, phone,
--     full_name, coordinates, or the address before approval);
--   * every Radar write locks the match row first, and a trigger enforces
--     occupancy <= max_players on Radar matches for every write path;
--   * all writes go through RPCs; tables expose SELECT only (RLS) to authenticated
--     and nothing to anon.
--
-- Time zone for match rules: America/Guatemala.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.radar_group_settings (
  group_id        uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  enabled         boolean NOT NULL DEFAULT false,
  show_group_name boolean NOT NULL DEFAULT false,
  updated_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.radar_listings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed')),
  radar_slots integer NOT NULL CHECK (radar_slots BETWEEN 1 AND 22),
  level_band  text NOT NULL DEFAULT 'any' CHECK (level_band IN ('any', 'casual', 'intermedio', 'competitivo')),
  positions   text[] NOT NULL DEFAULT '{}'
              CHECK (positions <@ ARRAY['Flexible', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward']::text[]),
  note        text CHECK (char_length(note) <= 200),
  zone_label  text NOT NULL CHECK (char_length(zone_label) BETWEEN 2 AND 60),
  close_at    timestamptz NOT NULL,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS radar_listings_group ON public.radar_listings (group_id);
CREATE INDEX IF NOT EXISTS radar_listings_open ON public.radar_listings (close_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.radar_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES public.radar_listings(id) ON DELETE CASCADE,
  match_id      uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  requester_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position      text CHECK (position IS NULL OR position IN ('Flexible', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward')),
  message       text CHECK (char_length(message) <= 280),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'canceled', 'expired')),
  decided_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at    timestamptz,
  decision_note text CHECK (char_length(decision_note) <= 200),
  attendance_id uuid REFERENCES public.attendances(id) ON DELETE SET NULL,
  late_cancel   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- One live request per person per match; a rejection also blocks re-requesting that match.
CREATE UNIQUE INDEX IF NOT EXISTS radar_requests_one_live
  ON public.radar_requests (match_id, requester_id)
  WHERE status IN ('pending', 'approved', 'rejected');
CREATE INDEX IF NOT EXISTS radar_requests_requester ON public.radar_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS radar_requests_listing ON public.radar_requests (listing_id, status);
CREATE INDEX IF NOT EXISTS radar_requests_group ON public.radar_requests (group_id);

CREATE TABLE IF NOT EXISTS public.radar_match_access (
  match_id   uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.radar_requests(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (match_id, profile_id)
);
CREATE INDEX IF NOT EXISTS radar_match_access_profile ON public.radar_match_access (profile_id);

CREATE TABLE IF NOT EXISTS public.radar_group_bans (
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN (
                 'radar_request_received', 'radar_request_approved', 'radar_request_rejected',
                 'radar_request_expired', 'radar_spot_canceled', 'radar_match_changed', 'radar_match_canceled')),
  listing_id   uuid REFERENCES public.radar_listings(id) ON DELETE SET NULL,
  request_id   uuid REFERENCES public.radar_requests(id) ON DELETE SET NULL,
  match_id     uuid REFERENCES public.matches(id) ON DELETE SET NULL,  -- only set for group admins' notices
  title        text NOT NULL CHECK (char_length(title) <= 120),
  body         text CHECK (char_length(body) <= 280),
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);
CREATE INDEX IF NOT EXISTS app_notifications_inbox ON public.app_notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_notifications_unread ON public.app_notifications (recipient_id) WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Internal helpers (not executable by clients)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.radar_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS radar_group_settings_touch ON public.radar_group_settings;
CREATE TRIGGER radar_group_settings_touch BEFORE UPDATE ON public.radar_group_settings
  FOR EACH ROW EXECUTE FUNCTION public.radar_touch_updated_at();
DROP TRIGGER IF EXISTS radar_listings_touch ON public.radar_listings;
CREATE TRIGGER radar_listings_touch BEFORE UPDATE ON public.radar_listings
  FOR EACH ROW EXECUTE FUNCTION public.radar_touch_updated_at();
DROP TRIGGER IF EXISTS radar_requests_touch ON public.radar_requests;
CREATE TRIGGER radar_requests_touch BEFORE UPDATE ON public.radar_requests
  FOR EACH ROW EXECUTE FUNCTION public.radar_touch_updated_at();

-- Match start as an instant, in the app's time zone. start_time is free text ("19:00").
CREATE OR REPLACE FUNCTION public.radar_match_start(p_date date, p_time text)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN p_date IS NULL THEN NULL ELSE
    ((p_date::text || ' ' ||
      CASE WHEN coalesce(p_time, '') ~ '^\d{1,2}:\d{2}' THEN substring(p_time FROM '^\d{1,2}:\d{2}') ELSE '00:00' END
     )::timestamp AT TIME ZONE 'America/Guatemala')
  END;
$$;

-- Same occupancy formula as register_guest_for_match: attendances + guest players.
-- The exclusions let the capacity trigger ignore the row being written (an upsert of an
-- already-confirmed player must not count that player twice).
CREATE OR REPLACE FUNCTION public.radar_occupancy(
  p_match_id uuid, p_exclude_attendance uuid DEFAULT NULL, p_exclude_profile uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.attendances a
      WHERE a.match_id = p_match_id AND a.status IN ('confirmed', 'checked_in')
        AND (p_exclude_attendance IS NULL OR a.id <> p_exclude_attendance)
        AND (p_exclude_profile IS NULL OR a.profile_id <> p_exclude_profile))::integer
  + (SELECT count(*) FROM public.guest_players g WHERE g.match_id = p_match_id)::integer;
$$;

CREATE OR REPLACE FUNCTION public.radar_public_name(p_profile_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(btrim(p.nickname), ''), 'Jugador') FROM public.profiles p WHERE p.id = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.radar_match_label(p_match_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_char(m.match_date, 'DD/MM') || coalesce(' ' || nullif(btrim(m.start_time), ''), '')
         || coalesce(' · ' || v.name, '')
  FROM public.matches m LEFT JOIN public.venues v ON v.id = m.venue_id
  WHERE m.id = p_match_id;
$$;

CREATE OR REPLACE FUNCTION public.radar_notify(
  p_recipient uuid, p_kind text, p_listing uuid, p_request uuid, p_match uuid, p_title text, p_body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.app_notifications (recipient_id, kind, listing_id, request_id, match_id, title, body)
  VALUES (p_recipient, p_kind, p_listing, p_request, p_match, left(p_title, 120), left(p_body, 280));
$$;

CREATE OR REPLACE FUNCTION public.radar_notify_admins(
  p_group uuid, p_kind text, p_listing uuid, p_request uuid, p_match uuid, p_title text, p_body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.app_notifications (recipient_id, kind, listing_id, request_id, match_id, title, body)
  SELECT gm.profile_id, p_kind, p_listing, p_request, p_match, left(p_title, 120), left(p_body, 280)
  FROM public.group_members gm
  WHERE gm.group_id = p_group AND gm.is_active = true AND gm.role IN ('admin', 'super_admin');
$$;

-- Close a listing and expire its pending requests (with a notice to each requester).
CREATE OR REPLACE FUNCTION public.radar_close_listing_internal(p_listing uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_label text;
BEGIN
  UPDATE public.radar_listings SET status = 'closed' WHERE id = p_listing AND status <> 'closed';
  FOR r IN
    UPDATE public.radar_requests SET status = 'expired'
    WHERE listing_id = p_listing AND status = 'pending'
    RETURNING id, requester_id, match_id
  LOOP
    v_label := public.radar_match_label(r.match_id);
    PERFORM public.radar_notify(r.requester_id, 'radar_request_expired', p_listing, r.id, NULL,
      'Solicitud sin respuesta', coalesce(v_label, 'Partido') || ' · ' || p_reason);
  END LOOP;
END;
$$;

-- Expire pending requests whose match already started.
CREATE OR REPLACE FUNCTION public.radar_expire_started()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.radar_requests r SET status = 'expired'
  FROM public.matches m
  WHERE r.match_id = m.id AND r.status = 'pending'
    AND public.radar_match_start(m.match_date, m.start_time) <= now();
$$;

-- All listings with computed, safe fields plus internal columns used for filtering.
CREATE OR REPLACE FUNCTION public.radar_listing_rows(p_listing_id uuid DEFAULT NULL)
RETURNS TABLE (
  listing_id uuid, match_id uuid, group_id uuid, listing_status text, match_status text,
  enabled boolean, starts_at timestamptz, close_at timestamptz,
  match_date date, start_time text, venue_name text, venue_address text, lat double precision, lng double precision,
  zone_label text, max_players integer, occupancy integer, radar_slots integer, approved_count integer,
  radar_slots_left integer, level_band text, positions text[], note text, cost_hint numeric, organizer_label text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.id, l.match_id, l.group_id, l.status, m.status,
    coalesce(s.enabled, false),
    public.radar_match_start(m.match_date, m.start_time), l.close_at,
    m.match_date, m.start_time, coalesce(v.name, 'Cancha'), v.address, v.lat, v.lng,
    l.zone_label, m.max_players, x.occ, l.radar_slots, x.approved,
    GREATEST(0, LEAST(l.radar_slots - x.approved, coalesce(m.max_players, 0) - x.occ)),
    l.level_band, l.positions, l.note,
    CASE WHEN coalesce(m.court_cost, 0) > 0 AND coalesce(m.max_players, 0) > 0
         THEN ceil(m.court_cost / m.max_players) END,
    CASE WHEN coalesce(s.show_group_name, false) THEN g.name ELSE 'Grupo privado' END
  FROM public.radar_listings l
  JOIN public.matches m ON m.id = l.match_id
  JOIN public.groups g ON g.id = l.group_id
  LEFT JOIN public.venues v ON v.id = m.venue_id
  LEFT JOIN public.radar_group_settings s ON s.group_id = l.group_id
  CROSS JOIN LATERAL (
    SELECT public.radar_occupancy(l.match_id) AS occ,
           (SELECT count(*)::integer FROM public.radar_requests r
             WHERE r.listing_id = l.id AND r.status = 'approved') AS approved
  ) x
  WHERE p_listing_id IS NULL OR l.id = p_listing_id;
$$;

-- Safe public JSON for one listing row (never match_id / group_id / address / coordinates).
CREATE OR REPLACE FUNCTION public.radar_listing_public_json(p_listing_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'listing_id', r.listing_id, 'listing_status', r.listing_status, 'match_status', r.match_status,
    'match_date', r.match_date, 'start_time', r.start_time, 'starts_at', r.starts_at, 'close_at', r.close_at,
    'venue_name', r.venue_name, 'zone_label', r.zone_label, 'max_players', r.max_players,
    'occupancy', r.occupancy, 'radar_slots_left', r.radar_slots_left, 'level_band', r.level_band,
    'positions', to_jsonb(r.positions), 'note', r.note, 'cost_hint', r.cost_hint,
    'organizer_label', r.organizer_label)
  FROM public.radar_listing_rows(p_listing_id) r;
$$;

-- -----------------------------------------------------------------------------
-- 3. RLS (SELECT only; writes go through RPCs)
-- -----------------------------------------------------------------------------

ALTER TABLE public.radar_group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_listings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_match_access   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_group_bans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.radar_group_settings, public.radar_listings, public.radar_requests,
  public.radar_match_access, public.radar_group_bans, public.app_notifications FROM anon, authenticated;
GRANT SELECT ON public.radar_group_settings, public.radar_listings, public.radar_requests,
  public.radar_match_access, public.radar_group_bans, public.app_notifications TO authenticated;

DROP POLICY IF EXISTS radar_group_settings_select_member ON public.radar_group_settings;
CREATE POLICY radar_group_settings_select_member ON public.radar_group_settings
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS radar_listings_select_member ON public.radar_listings;
CREATE POLICY radar_listings_select_member ON public.radar_listings
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS radar_requests_select_own_or_admin ON public.radar_requests;
CREATE POLICY radar_requests_select_own_or_admin ON public.radar_requests
  FOR SELECT TO authenticated USING (requester_id = auth.uid() OR public.is_group_admin(group_id));

DROP POLICY IF EXISTS radar_match_access_select_own_or_admin ON public.radar_match_access;
CREATE POLICY radar_match_access_select_own_or_admin ON public.radar_match_access
  FOR SELECT TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.matches m WHERE m.id = radar_match_access.match_id AND public.is_group_admin(m.group_id))
  );

DROP POLICY IF EXISTS radar_group_bans_select_admin ON public.radar_group_bans;
CREATE POLICY radar_group_bans_select_admin ON public.radar_group_bans
  FOR SELECT TO authenticated USING (public.is_group_admin(group_id));

DROP POLICY IF EXISTS app_notifications_select_own ON public.app_notifications;
CREATE POLICY app_notifications_select_own ON public.app_notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. RPCs (authenticated only)
-- -----------------------------------------------------------------------------

-- 4.1 Group switch (super_admin)
CREATE OR REPLACE FUNCTION public.radar_set_group_settings(p_group_id uuid, p_enabled boolean, p_show_group_name boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.radar_group_settings; l record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_super_admin(p_group_id) THEN
    RAISE EXCEPTION 'Solo el super admin del grupo puede configurar Radar.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.radar_group_settings (group_id, enabled, show_group_name, updated_by)
  VALUES (p_group_id, coalesce(p_enabled, false), coalesce(p_show_group_name, false), auth.uid())
  ON CONFLICT (group_id) DO UPDATE
    SET enabled = EXCLUDED.enabled, show_group_name = EXCLUDED.show_group_name, updated_by = EXCLUDED.updated_by
  RETURNING * INTO v_row;
  IF NOT v_row.enabled THEN
    FOR l IN SELECT id FROM public.radar_listings WHERE group_id = p_group_id AND status <> 'closed' LOOP
      PERFORM public.radar_close_listing_internal(l.id, 'El grupo desactivó Radar.');
    END LOOP;
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

-- 4.2 Publish or update a match listing (group admin)
CREATE OR REPLACE FUNCTION public.radar_publish_match(
  p_match_id uuid, p_radar_slots integer, p_level_band text DEFAULT 'any', p_positions text[] DEFAULT '{}',
  p_note text DEFAULT NULL, p_zone_label text DEFAULT NULL, p_close_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_m public.matches; v_v public.venues; v_start timestamptz; v_close timestamptz;
  v_occ integer; v_approved integer := 0; v_zone text; v_note text; v_listing public.radar_listings;
BEGIN
  SELECT * INTO v_m FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado.'; END IF;
  IF auth.uid() IS NULL OR NOT public.is_group_admin(v_m.group_id) THEN
    RAISE EXCEPTION 'Solo un admin del grupo puede publicar en Radar.' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce((SELECT enabled FROM public.radar_group_settings WHERE group_id = v_m.group_id), false) THEN
    RAISE EXCEPTION 'Radar está desactivado para este grupo. El super admin puede activarlo en Grupos → Configuración.';
  END IF;
  v_start := public.radar_match_start(v_m.match_date, v_m.start_time);
  IF v_m.status <> 'upcoming' OR v_start IS NULL OR v_start <= now() THEN
    RAISE EXCEPTION 'Solo se pueden publicar partidos próximos.';
  END IF;
  IF coalesce(array_length(v_m.allowed_tags, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Este partido está limitado a tags del grupo. Quitá los tags para publicarlo en Radar.';
  END IF;
  SELECT * INTO v_v FROM public.venues WHERE id = v_m.venue_id AND group_id = v_m.group_id;
  IF NOT FOUND OR v_v.lat IS NULL OR v_v.lng IS NULL THEN
    RAISE EXCEPTION 'El partido necesita una sede con ubicación en el mapa.';
  END IF;
  IF coalesce(v_m.max_players, 0) <= 0 THEN RAISE EXCEPTION 'El partido necesita un cupo máximo.'; END IF;
  IF p_radar_slots IS NULL OR p_radar_slots < 1 OR p_radar_slots > 22 THEN
    RAISE EXCEPTION 'Los cupos de Radar deben estar entre 1 y 22.';
  END IF;
  IF coalesce(p_level_band, 'any') NOT IN ('any', 'casual', 'intermedio', 'competitivo') THEN
    RAISE EXCEPTION 'Nivel inválido.';
  END IF;
  IF NOT (coalesce(p_positions, '{}') <@ ARRAY['Flexible', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward']::text[]) THEN
    RAISE EXCEPTION 'Posición inválida.';
  END IF;

  v_occ := public.radar_occupancy(v_m.id);
  SELECT count(*) INTO v_approved FROM public.radar_requests r
    JOIN public.radar_listings l ON l.id = r.listing_id
    WHERE l.match_id = v_m.id AND r.status = 'approved';
  IF p_radar_slots < v_approved THEN
    RAISE EXCEPTION 'Ya aceptaste % jugadores de Radar; los cupos no pueden ser menos.', v_approved;
  END IF;
  IF p_radar_slots - v_approved > v_m.max_players - v_occ THEN
    RAISE EXCEPTION 'Solo quedan % cupos libres en el partido.', GREATEST(0, v_m.max_players - v_occ);
  END IF;

  v_zone := coalesce(nullif(btrim(p_zone_label), ''), v_v.name);
  IF char_length(v_zone) < 2 OR char_length(v_zone) > 60 THEN
    RAISE EXCEPTION 'La zona debe tener entre 2 y 60 caracteres.';
  END IF;
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  IF char_length(v_note) > 200 THEN RAISE EXCEPTION 'La nota admite hasta 200 caracteres.'; END IF;

  v_close := coalesce(p_close_at, v_start - interval '2 hours');
  IF p_close_at IS NULL AND v_close <= now() THEN v_close := v_start - interval '15 minutes'; END IF;
  IF v_close > v_start THEN RAISE EXCEPTION 'El cierre de solicitudes debe ser antes del partido.'; END IF;
  IF v_close <= now() THEN RAISE EXCEPTION 'El partido empieza muy pronto para publicarlo en Radar.'; END IF;

  INSERT INTO public.radar_listings
    (match_id, group_id, status, radar_slots, level_band, positions, note, zone_label, close_at, created_by)
  VALUES (v_m.id, v_m.group_id, 'open', p_radar_slots, coalesce(p_level_band, 'any'), coalesce(p_positions, '{}'),
          v_note, v_zone, v_close, auth.uid())
  ON CONFLICT (match_id) DO UPDATE SET
    status = 'open', radar_slots = EXCLUDED.radar_slots, level_band = EXCLUDED.level_band,
    positions = EXCLUDED.positions, note = EXCLUDED.note, zone_label = EXCLUDED.zone_label,
    close_at = EXCLUDED.close_at
  RETURNING * INTO v_listing;

  RETURN to_jsonb(v_listing);
END;
$$;

-- 4.3 Pause / reopen / close a listing (group admin)
CREATE OR REPLACE FUNCTION public.radar_set_listing_status(p_listing_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.radar_listings; v_m public.matches;
BEGIN
  SELECT * INTO v_l FROM public.radar_listings WHERE id = p_listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Publicación no encontrada.'; END IF;
  IF auth.uid() IS NULL OR NOT public.is_group_admin(v_l.group_id) THEN
    RAISE EXCEPTION 'Solo un admin del grupo puede cambiar la publicación.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_m FROM public.matches WHERE id = v_l.match_id FOR UPDATE;
  IF p_status = 'closed' THEN
    PERFORM public.radar_close_listing_internal(v_l.id, 'El organizador cerró la publicación.');
  ELSIF p_status = 'paused' THEN
    UPDATE public.radar_listings SET status = 'paused' WHERE id = v_l.id AND status = 'open';
  ELSIF p_status = 'open' THEN
    IF NOT coalesce((SELECT enabled FROM public.radar_group_settings WHERE group_id = v_l.group_id), false) THEN
      RAISE EXCEPTION 'Radar está desactivado para este grupo.';
    END IF;
    IF v_m.status <> 'upcoming' OR v_l.close_at <= now() THEN
      RAISE EXCEPTION 'La publicación ya cerró. Volvé a publicar el partido con un nuevo cierre.';
    END IF;
    UPDATE public.radar_listings SET status = 'open' WHERE id = v_l.id;
  ELSE
    RAISE EXCEPTION 'Estado inválido.';
  END IF;
  SELECT * INTO v_l FROM public.radar_listings WHERE id = p_listing_id;
  RETURN to_jsonb(v_l);
END;
$$;

-- 4.4 Discovery (any signed-in user; never returns match/group ids, address or coordinates)
CREATE OR REPLACE FUNCTION public.radar_nearby(
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL, p_radius_km numeric DEFAULT 10,
  p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_level text DEFAULT NULL, p_zone text DEFAULT NULL)
RETURNS TABLE (
  listing_id uuid, match_date date, start_time text, venue_name text, zone_label text,
  distance_bucket text, bucket_rank integer, max_players integer, occupancy integer, radar_slots_left integer,
  level_band text, positions text[], note text, cost_hint numeric, organizer_label text, my_request_status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH args AS (
    SELECT
      round(p_lat::numeric, 2)::double precision AS lat,
      round(p_lng::numeric, 2)::double precision AS lng,
      LEAST(GREATEST(coalesce(p_radius_km, 10), 1), 15)::double precision AS radius,
      coalesce(p_from, (now() AT TIME ZONE 'America/Guatemala')::date) AS d_from
  ), win AS (
    SELECT a.*, LEAST(coalesce(p_to, a.d_from + 14), a.d_from + 14) AS d_to FROM args a
  ), base AS (
    SELECT r.*,
      CASE WHEN w.lat IS NULL OR w.lng IS NULL THEN NULL ELSE
        6371 * 2 * asin(sqrt(
          power(sin(radians(r.lat - w.lat) / 2), 2)
          + cos(radians(w.lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - w.lng) / 2), 2)))
      END AS km,
      w.radius
    FROM public.radar_listing_rows() r, win w
    WHERE auth.uid() IS NOT NULL
      AND r.listing_status = 'open' AND r.enabled AND r.match_status = 'upcoming'
      AND r.close_at > now() AND r.starts_at > now()
      AND r.match_date BETWEEN w.d_from AND w.d_to
      AND r.radar_slots_left > 0
      AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = r.group_id AND gm.profile_id = auth.uid())
      AND NOT EXISTS (SELECT 1 FROM public.radar_group_bans b WHERE b.group_id = r.group_id AND b.profile_id = auth.uid())
      AND (p_level IS NULL OR p_level = 'any' OR r.level_band IN (p_level, 'any'))
      AND (p_zone IS NULL OR btrim(p_zone) = '' OR lower(r.zone_label) = lower(btrim(p_zone)))
  )
  SELECT b.listing_id, b.match_date, b.start_time, b.venue_name, b.zone_label,
    CASE WHEN b.km IS NULL THEN NULL WHEN b.km < 2 THEN '<2 km' WHEN b.km < 5 THEN '2–5 km'
         WHEN b.km < 10 THEN '5–10 km' ELSE '10–15 km' END,
    CASE WHEN b.km IS NULL THEN NULL WHEN b.km < 2 THEN 1 WHEN b.km < 5 THEN 2 WHEN b.km < 10 THEN 3 ELSE 4 END,
    b.max_players, b.occupancy, b.radar_slots_left, b.level_band, b.positions, b.note, b.cost_hint, b.organizer_label,
    (SELECT rq.status FROM public.radar_requests rq
      WHERE rq.listing_id = b.listing_id AND rq.requester_id = auth.uid()
      ORDER BY rq.created_at DESC LIMIT 1)
  FROM base b
  WHERE b.km IS NULL OR b.km <= b.radius
  ORDER BY 7 NULLS LAST, b.starts_at
  LIMIT 100;
$$;

-- 4.5 Zones with open listings (for the zone picker)
CREATE OR REPLACE FUNCTION public.radar_zones()
RETURNS TABLE (zone_label text, listings integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT min(r.zone_label), count(*)::integer
  FROM public.radar_listing_rows() r
  WHERE auth.uid() IS NOT NULL
    AND r.listing_status = 'open' AND r.enabled AND r.match_status = 'upcoming'
    AND r.close_at > now() AND r.starts_at > now() AND r.radar_slots_left > 0
    AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = r.group_id AND gm.profile_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.radar_group_bans b WHERE b.group_id = r.group_id AND b.profile_id = auth.uid())
  GROUP BY lower(r.zone_label)
  ORDER BY 1;
$$;

-- Approved extras for the caller (address, fee, fine). NULL when the caller has no active access.
CREATE OR REPLACE FUNCTION public.radar_private_extras(p_match_id uuid, p_group_id uuid, p_uid uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.radar_match_access a
                           WHERE a.match_id = p_match_id AND a.profile_id = p_uid AND a.revoked_at IS NULL)
  THEN jsonb_build_object(
    'venue_address', (SELECT v.address FROM public.matches m LEFT JOIN public.venues v ON v.id = m.venue_id WHERE m.id = p_match_id),
    'per_player_amount', (SELECT f.per_player_amount FROM public.match_fees f WHERE f.match_id = p_match_id),
    'payment_status', (SELECT p.status FROM public.match_fee_payments p JOIN public.match_fees f ON f.id = p.match_fee_id
                       WHERE f.match_id = p_match_id AND p.profile_id = p_uid LIMIT 1))
  END;
$$;

-- 4.6 One listing for the caller (discoverable, or the caller has a request for it)
CREATE OR REPLACE FUNCTION public.radar_listing_card(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_req public.radar_requests; v_fine numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para ver Radar.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.radar_listing_rows(p_listing_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no disponible.'; END IF;
  SELECT * INTO v_req FROM public.radar_requests
    WHERE listing_id = p_listing_id AND requester_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
  IF v_req.id IS NULL AND NOT (
       r.listing_status = 'open' AND r.enabled AND r.match_status = 'upcoming' AND r.close_at > now()
       AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = r.group_id AND gm.profile_id = auth.uid())
       AND NOT EXISTS (SELECT 1 FROM public.radar_group_bans b WHERE b.group_id = r.group_id AND b.profile_id = auth.uid())) THEN
    RAISE EXCEPTION 'Partido no disponible.';
  END IF;
  SELECT coalesce((SELECT s.late_cancel_fine_amount FROM public.settings s WHERE s.group_id = r.group_id
                   ORDER BY s.created_at LIMIT 1), 25) INTO v_fine;
  RETURN public.radar_listing_public_json(p_listing_id)
    || jsonb_build_object(
         'rules', jsonb_build_object('late_cancel_hours', 4, 'late_cancel_fine_amount', v_fine, 'payment', 'on_site'),
         'my_request', CASE WHEN v_req.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', v_req.id, 'status', v_req.status, 'position', v_req.position, 'message', v_req.message,
            'decision_note', v_req.decision_note, 'late_cancel', v_req.late_cancel, 'created_at', v_req.created_at) END,
         'private', public.radar_private_extras(r.match_id, r.group_id, auth.uid()));
END;
$$;

-- 4.7 Request a spot
CREATE OR REPLACE FUNCTION public.radar_request_spot(p_listing_id uuid, p_position text DEFAULT NULL, p_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_l public.radar_listings; v_m public.matches; r record;
  v_msg text; v_req public.radar_requests; v_existing text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para pedir un cupo.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_l FROM public.radar_listings WHERE id = p_listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no disponible.'; END IF;
  SELECT * INTO v_m FROM public.matches WHERE id = v_l.match_id FOR UPDATE;
  SELECT * INTO r FROM public.radar_listing_rows(p_listing_id);

  IF EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = v_l.group_id AND gm.profile_id = v_uid) THEN
    RAISE EXCEPTION 'Ya sos parte de este grupo: confirmá tu asistencia desde Partidos.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.radar_group_bans b WHERE b.group_id = v_l.group_id AND b.profile_id = v_uid) THEN
    RAISE EXCEPTION 'Partido no disponible.';
  END IF;
  IF NOT (r.listing_status = 'open' AND r.enabled AND r.match_status = 'upcoming'
          AND r.close_at > now() AND r.starts_at > now()) THEN
    RAISE EXCEPTION 'Las solicitudes para este partido están cerradas.';
  END IF;
  IF r.radar_slots_left <= 0 THEN RAISE EXCEPTION 'Ya no quedan cupos de Radar en este partido.'; END IF;

  SELECT status INTO v_existing FROM public.radar_requests
    WHERE match_id = v_l.match_id AND requester_id = v_uid AND status IN ('pending', 'approved', 'rejected') LIMIT 1;
  IF v_existing = 'rejected' THEN RAISE EXCEPTION 'El organizador ya respondió tu solicitud para este partido.'; END IF;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'Ya tenés una solicitud para este partido.'; END IF;

  IF nullif(btrim((SELECT nickname FROM public.profiles WHERE id = v_uid)), '') IS NULL THEN
    RAISE EXCEPTION 'Agregá un apodo en tu perfil antes de pedir un cupo.';
  END IF;
  IF (SELECT count(*) FROM public.radar_requests WHERE requester_id = v_uid AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'Llegaste al límite de 10 solicitudes por día.';
  END IF;
  IF (SELECT count(*) FROM public.radar_requests WHERE requester_id = v_uid AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'Tenés 3 solicitudes pendientes. Esperá una respuesta o retirá alguna.';
  END IF;
  IF p_position IS NOT NULL AND p_position NOT IN ('Flexible', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward') THEN
    RAISE EXCEPTION 'Posición inválida.';
  END IF;
  v_msg := nullif(btrim(regexp_replace(coalesce(p_message, ''), '\s+', ' ', 'g')), '');
  IF char_length(v_msg) > 280 THEN RAISE EXCEPTION 'El mensaje admite hasta 280 caracteres.'; END IF;

  BEGIN
    INSERT INTO public.radar_requests (listing_id, match_id, group_id, requester_id, position, message)
    VALUES (v_l.id, v_l.match_id, v_l.group_id, v_uid, p_position, v_msg)
    RETURNING * INTO v_req;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya tenés una solicitud para este partido.';
  END;

  PERFORM public.radar_notify_admins(v_l.group_id, 'radar_request_received', v_l.id, v_req.id, v_l.match_id,
    'Nueva solicitud en Radar',
    public.radar_public_name(v_uid) || ' pidió un cupo · ' || coalesce(public.radar_match_label(v_l.match_id), 'Partido'));

  RETURN jsonb_build_object('request_id', v_req.id, 'status', v_req.status);
END;
$$;

-- 4.8 Approve or reject (group admin)
CREATE OR REPLACE FUNCTION public.radar_decide_request(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.radar_requests; v_l public.radar_listings; v_m public.matches; v_note text;
  v_approved integer; v_att uuid; v_label text;
BEGIN
  SELECT * INTO v_req FROM public.radar_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;
  IF auth.uid() IS NULL OR NOT public.is_group_admin(v_req.group_id) THEN
    RAISE EXCEPTION 'Solo un admin del grupo puede responder solicitudes.' USING ERRCODE = '42501';
  END IF;
  -- Lock order: match row first, then the request.
  SELECT * INTO v_m FROM public.matches WHERE id = v_req.match_id FOR UPDATE;
  SELECT * INTO v_req FROM public.radar_requests WHERE id = p_request_id FOR UPDATE;
  SELECT * INTO v_l FROM public.radar_listings WHERE id = v_req.listing_id;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'La solicitud ya fue respondida.'; END IF;
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  IF char_length(v_note) > 200 THEN RAISE EXCEPTION 'La nota admite hasta 200 caracteres.'; END IF;
  v_label := coalesce(public.radar_match_label(v_m.id), 'Partido');

  IF p_approve THEN
    IF v_l.status = 'closed' THEN RAISE EXCEPTION 'La publicación está cerrada.'; END IF;
    IF v_m.status <> 'upcoming' OR public.radar_match_start(v_m.match_date, v_m.start_time) <= now() THEN
      RAISE EXCEPTION 'El partido ya no está disponible.';
    END IF;
    SELECT count(*) INTO v_approved FROM public.radar_requests WHERE listing_id = v_l.id AND status = 'approved';
    IF v_approved >= v_l.radar_slots THEN RAISE EXCEPTION 'Ya se cubrieron los cupos de Radar.'; END IF;
    IF public.radar_occupancy(v_m.id) >= coalesce(v_m.max_players, 0) THEN
      RAISE EXCEPTION 'El partido ya alcanzó el cupo máximo.';
    END IF;

    INSERT INTO public.attendances (match_id, profile_id, status, checked_in)
    VALUES (v_m.id, v_req.requester_id, 'confirmed', false)
    ON CONFLICT (match_id, profile_id) DO UPDATE SET status = 'confirmed', checked_in = false
    RETURNING id INTO v_att;

    INSERT INTO public.radar_match_access (match_id, profile_id, request_id, granted_by)
    VALUES (v_m.id, v_req.requester_id, v_req.id, auth.uid())
    ON CONFLICT (match_id, profile_id) DO UPDATE
      SET request_id = EXCLUDED.request_id, granted_by = EXCLUDED.granted_by, granted_at = now(), revoked_at = NULL;

    UPDATE public.radar_requests
      SET status = 'approved', attendance_id = v_att, decided_by = auth.uid(), decided_at = now(), decision_note = v_note
      WHERE id = v_req.id;

    PERFORM public.radar_notify(v_req.requester_id, 'radar_request_approved', v_l.id, v_req.id, NULL,
      'Te aceptaron en Radar', v_label || ' · Revisá la dirección en Radar → Mis partidos.');

    RETURN jsonb_build_object(
      'status', 'approved', 'request_id', v_req.id, 'match_id', v_m.id, 'group_id', v_m.group_id,
      'attendance_id', v_att, 'court_cost', v_m.court_cost, 'match_date', v_m.match_date, 'start_time', v_m.start_time,
      'confirmed_profile_ids', (SELECT coalesce(jsonb_agg(a.profile_id ORDER BY a.created_at), '[]'::jsonb)
                                FROM public.attendances a WHERE a.match_id = v_m.id AND a.status IN ('confirmed', 'checked_in')));
  ELSE
    UPDATE public.radar_requests
      SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = v_note
      WHERE id = v_req.id;
    PERFORM public.radar_notify(v_req.requester_id, 'radar_request_rejected', v_l.id, v_req.id, NULL,
      'Solicitud no aceptada', v_label || coalesce(' · ' || v_note, ''));
    RETURN jsonb_build_object('status', 'rejected', 'request_id', v_req.id, 'match_id', v_m.id, 'group_id', v_m.group_id);
  END IF;
END;
$$;

-- 4.9 The approved player cancels (same 4 h late-cancel rule and amount as the group)
CREATE OR REPLACE FUNCTION public.radar_cancel_spot(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.radar_requests; v_m public.matches; v_start timestamptz; v_late boolean; v_amount numeric := NULL;
BEGIN
  SELECT * INTO v_req FROM public.radar_requests WHERE id = p_request_id;
  IF NOT FOUND OR auth.uid() IS NULL OR v_req.requester_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solicitud no encontrada.';
  END IF;
  SELECT * INTO v_m FROM public.matches WHERE id = v_req.match_id FOR UPDATE;
  SELECT * INTO v_req FROM public.radar_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.status <> 'approved' THEN RAISE EXCEPTION 'Solo podés cancelar un cupo aceptado.'; END IF;
  v_start := public.radar_match_start(v_m.match_date, v_m.start_time);
  IF v_start <= now() THEN RAISE EXCEPTION 'El partido ya empezó.'; END IF;

  UPDATE public.attendances SET status = 'canceled', checked_in = false
    WHERE match_id = v_m.id AND profile_id = v_req.requester_id;
  UPDATE public.radar_match_access SET revoked_at = now()
    WHERE match_id = v_m.id AND profile_id = v_req.requester_id;

  v_late := (v_start - now()) < interval '4 hours';
  IF v_late THEN
    v_amount := coalesce((SELECT s.late_cancel_fine_amount FROM public.settings s WHERE s.group_id = v_m.group_id
                          ORDER BY s.created_at LIMIT 1), 25);
    IF NOT EXISTS (SELECT 1 FROM public.fines f WHERE f.match_id = v_m.id AND f.profile_id = v_req.requester_id
                     AND f.reason = 'late_cancel' AND f.status = 'open') THEN
      INSERT INTO public.fines (group_id, profile_id, match_id, reason, amount, status)
      VALUES (v_m.group_id, v_req.requester_id, v_m.id, 'late_cancel', v_amount, 'open');
    END IF;
  END IF;

  UPDATE public.radar_requests SET status = 'canceled', late_cancel = v_late WHERE id = v_req.id;

  PERFORM public.radar_notify_admins(v_m.group_id, 'radar_spot_canceled', v_req.listing_id, v_req.id, v_m.id,
    'Cupo de Radar liberado',
    public.radar_public_name(v_req.requester_id) || ' canceló · ' || coalesce(public.radar_match_label(v_m.id), 'Partido')
      || CASE WHEN v_late THEN ' · Cancelación tardía (multa Q' || v_amount::text || ')' ELSE '' END);

  RETURN jsonb_build_object('status', 'canceled', 'late_cancel', v_late, 'fine_amount', v_amount);
END;
$$;

-- 4.10 Withdraw (pending) — an approved spot goes through radar_cancel_spot
CREATE OR REPLACE FUNCTION public.radar_withdraw_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.radar_requests;
BEGIN
  SELECT * INTO v_req FROM public.radar_requests WHERE id = p_request_id;
  IF NOT FOUND OR auth.uid() IS NULL OR v_req.requester_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solicitud no encontrada.';
  END IF;
  IF v_req.status = 'approved' THEN RETURN public.radar_cancel_spot(p_request_id); END IF;
  UPDATE public.radar_requests SET status = 'withdrawn' WHERE id = p_request_id AND status = 'pending'
    RETURNING * INTO v_req;
  IF v_req.status IS DISTINCT FROM 'withdrawn' THEN RAISE EXCEPTION 'La solicitud ya no está pendiente.'; END IF;
  RETURN jsonb_build_object('status', 'withdrawn');
END;
$$;

-- 4.11 Requests of the caller (with safe listing data, and private extras once approved)
CREATE OR REPLACE FUNCTION public.radar_my_requests()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para ver Radar.' USING ERRCODE = '42501'; END IF;
  PERFORM public.radar_expire_started();
  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', rq.id, 'status', rq.status, 'position', rq.position, 'message', rq.message,
        'decision_note', rq.decision_note, 'late_cancel', rq.late_cancel,
        'created_at', rq.created_at, 'decided_at', rq.decided_at,
        'listing', public.radar_listing_public_json(rq.listing_id),
        'private', public.radar_private_extras(rq.match_id, rq.group_id, v_uid),
        'fine', (SELECT jsonb_build_object('amount', f.amount, 'status', f.status) FROM public.fines f
                 WHERE f.match_id = rq.match_id AND f.profile_id = v_uid AND f.reason = 'late_cancel'
                 ORDER BY f.created_at DESC LIMIT 1))
      ORDER BY rq.created_at DESC)
    FROM public.radar_requests rq WHERE rq.requester_id = v_uid
  ), '[]'::jsonb);
END;
$$;

-- 4.12 Requests for one match (group admin), with the requester's public identity only
CREATE OR REPLACE FUNCTION public.radar_admin_requests(p_match_id uuid)
RETURNS TABLE (
  request_id uuid, requester_id uuid, nickname text, avatar_url text, preferred_position text,
  "position" text, message text, status text, decision_note text, late_cancel boolean,
  created_at timestamptz, decided_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group uuid;
BEGIN
  SELECT m.group_id INTO v_group FROM public.matches m WHERE m.id = p_match_id;
  IF v_group IS NULL OR auth.uid() IS NULL OR NOT public.is_group_admin(v_group) THEN
    RAISE EXCEPTION 'Solo un admin del grupo puede ver las solicitudes.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.radar_expire_started();
  RETURN QUERY
    SELECT rq.id, rq.requester_id, public.radar_public_name(rq.requester_id), p.avatar_url, p.preferred_position,
           rq.position, rq.message, rq.status, rq.decision_note, rq.late_cancel, rq.created_at, rq.decided_at
    FROM public.radar_requests rq JOIN public.profiles p ON p.id = rq.requester_id
    WHERE rq.match_id = p_match_id
    ORDER BY (rq.status = 'pending') DESC, rq.created_at;
END;
$$;

-- 4.13 Roster for an approved outsider (nicknames only; no profile ids except the caller's)
CREATE OR REPLACE FUNCTION public.radar_match_people(p_listing_id uuid)
RETURNS TABLE (profile_id uuid, nickname text, avatar_url text, preferred_position text, is_radar boolean, is_me boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.radar_listings;
BEGIN
  SELECT * INTO v_l FROM public.radar_listings WHERE id = p_listing_id;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT (
       public.is_group_member(v_l.group_id)
       OR EXISTS (SELECT 1 FROM public.radar_match_access a
                  WHERE a.match_id = v_l.match_id AND a.profile_id = auth.uid() AND a.revoked_at IS NULL)) THEN
    RAISE EXCEPTION 'Partido no disponible.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT CASE WHEN a.profile_id = auth.uid() OR public.is_group_member(v_l.group_id) THEN a.profile_id END,
           public.radar_public_name(a.profile_id), p.avatar_url, p.preferred_position,
           NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = v_l.group_id AND gm.profile_id = a.profile_id),
           a.profile_id = auth.uid()
    FROM public.attendances a JOIN public.profiles p ON p.id = a.profile_id
    WHERE a.match_id = v_l.match_id AND a.status IN ('confirmed', 'checked_in')
    ORDER BY a.created_at;
END;
$$;

-- 4.14 Public identity of every Radar player who joined this group's matches (members only).
-- Used for fallback names in attendance, Cobros, Multas and Equipos (profiles RLS hides outsiders).
CREATE OR REPLACE FUNCTION public.radar_group_outsiders(p_group_id uuid)
RETURNS TABLE (profile_id uuid, nickname text, avatar_url text, preferred_position text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Sin acceso al grupo.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT DISTINCT a.profile_id, public.radar_public_name(a.profile_id), p.avatar_url, p.preferred_position
    FROM public.radar_match_access a
    JOIN public.matches m ON m.id = a.match_id
    JOIN public.profiles p ON p.id = a.profile_id
    WHERE m.group_id = p_group_id;
END;
$$;

-- 4.15 Ban / unban a requester for the group (group admin)
CREATE OR REPLACE FUNCTION public.radar_ban_requester(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.radar_requests; r record;
BEGIN
  SELECT * INTO v_req FROM public.radar_requests WHERE id = p_request_id;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_group_admin(v_req.group_id) THEN
    RAISE EXCEPTION 'Solo un admin del grupo puede bloquear.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.radar_group_bans (group_id, profile_id, created_by)
  VALUES (v_req.group_id, v_req.requester_id, auth.uid()) ON CONFLICT DO NOTHING;
  FOR r IN
    UPDATE public.radar_requests SET status = 'rejected', decided_by = auth.uid(), decided_at = now()
    WHERE group_id = v_req.group_id AND requester_id = v_req.requester_id AND status = 'pending'
    RETURNING id, listing_id, match_id
  LOOP
    PERFORM public.radar_notify(v_req.requester_id, 'radar_request_rejected', r.listing_id, r.id, NULL,
      'Solicitud no aceptada', coalesce(public.radar_match_label(r.match_id), 'Partido'));
  END LOOP;
  RETURN jsonb_build_object('banned', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.radar_group_bans_list(p_group_id uuid)
RETURNS TABLE (profile_id uuid, nickname text, avatar_url text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_admin(p_group_id) THEN
    RAISE EXCEPTION 'Solo un admin del grupo puede ver bloqueos.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT b.profile_id, public.radar_public_name(b.profile_id), p.avatar_url, b.created_at
    FROM public.radar_group_bans b JOIN public.profiles p ON p.id = b.profile_id
    WHERE b.group_id = p_group_id ORDER BY b.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.radar_unban(p_group_id uuid, p_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_admin(p_group_id) THEN
    RAISE EXCEPTION 'Solo un admin del grupo puede desbloquear.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.radar_group_bans WHERE group_id = p_group_id AND profile_id = p_profile_id;
  RETURN jsonb_build_object('banned', false);
END;
$$;

-- 4.16 Notifications
CREATE OR REPLACE FUNCTION public.notifications_mark_read(p_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión.' USING ERRCODE = '42501'; END IF;
  UPDATE public.app_notifications SET read_at = now()
    WHERE recipient_id = auth.uid() AND read_at IS NULL AND (p_ids IS NULL OR id = ANY (p_ids));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Triggers that only act on Radar matches
-- -----------------------------------------------------------------------------

-- 5.1 Capacity on attendances (every write path: member confirm, admin, Radar approval)
CREATE OR REPLACE FUNCTION public.radar_enforce_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max integer;
BEGIN
  IF NEW.status NOT IN ('confirmed', 'checked_in') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('confirmed', 'checked_in') AND OLD.match_id = NEW.match_id THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.radar_listings l WHERE l.match_id = NEW.match_id) THEN RETURN NEW; END IF;
  SELECT m.max_players INTO v_max FROM public.matches m WHERE m.id = NEW.match_id FOR UPDATE;
  IF coalesce(v_max, 0) > 0 AND public.radar_occupancy(NEW.match_id, NEW.id, NEW.profile_id) >= v_max THEN
    RAISE EXCEPTION 'El partido ya alcanzó el cupo máximo.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS radar_enforce_capacity ON public.attendances;
CREATE TRIGGER radar_enforce_capacity BEFORE INSERT OR UPDATE OF status, match_id ON public.attendances
  FOR EACH ROW EXECUTE FUNCTION public.radar_enforce_capacity();

-- 5.2 Capacity on guest players
CREATE OR REPLACE FUNCTION public.radar_enforce_capacity_guests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.radar_listings l WHERE l.match_id = NEW.match_id) THEN RETURN NEW; END IF;
  SELECT m.max_players INTO v_max FROM public.matches m WHERE m.id = NEW.match_id FOR UPDATE;
  IF coalesce(v_max, 0) > 0 AND public.radar_occupancy(NEW.match_id) >= v_max THEN
    RAISE EXCEPTION 'El partido ya alcanzó el cupo máximo.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS radar_enforce_capacity_guests ON public.guest_players;
CREATE TRIGGER radar_enforce_capacity_guests BEFORE INSERT ON public.guest_players
  FOR EACH ROW EXECUTE FUNCTION public.radar_enforce_capacity_guests();

-- 5.3 Match canceled / closed / rescheduled → close listing and notify Radar players. Never blocks.
CREATE OR REPLACE FUNCTION public.radar_after_match_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l public.radar_listings; r record; v_label text;
BEGIN
  SELECT * INTO v_l FROM public.radar_listings WHERE match_id = NEW.id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  BEGIN
    v_label := coalesce(public.radar_match_label(NEW.id), 'Partido');
    IF NEW.status IN ('canceled', 'closed') AND OLD.status = 'upcoming' THEN
      PERFORM public.radar_close_listing_internal(v_l.id,
        CASE WHEN NEW.status = 'canceled' THEN 'El partido fue cancelado.' ELSE 'El partido se cerró.' END);
      IF NEW.status = 'canceled' THEN
        FOR r IN SELECT id, requester_id FROM public.radar_requests WHERE listing_id = v_l.id AND status = 'approved' LOOP
          PERFORM public.radar_notify(r.requester_id, 'radar_match_canceled', v_l.id, r.id, NULL,
            'Partido cancelado', v_label);
        END LOOP;
      END IF;
    ELSIF NEW.status = 'upcoming' AND (OLD.match_date IS DISTINCT FROM NEW.match_date
          OR OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.venue_id IS DISTINCT FROM NEW.venue_id) THEN
      FOR r IN SELECT id, requester_id FROM public.radar_requests WHERE listing_id = v_l.id AND status IN ('approved', 'pending') LOOP
        PERFORM public.radar_notify(r.requester_id, 'radar_match_changed', v_l.id, r.id, NULL,
          'El partido cambió', 'Nuevo horario o sede: ' || v_label);
      END LOOP;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'radar_after_match_change: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS radar_after_match_change ON public.matches;
CREATE TRIGGER radar_after_match_change AFTER UPDATE OF status, match_date, start_time, venue_id ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.radar_after_match_change();

-- 5.4 Radar players join a group only by their own request. Older app versions auto-added any
--     attendee who was not a member ("orphan" repair); that must never turn a Radar player into a
--     member (is_group_member would then expose the group's data). Service role (no auth.uid()) is
--     unaffected, and so is everyone without Radar access to the group.
CREATE OR REPLACE FUNCTION public.radar_guard_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.profile_id = auth.uid() THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.radar_match_access a JOIN public.matches m ON m.id = a.match_id
             WHERE a.profile_id = NEW.profile_id AND m.group_id = NEW.group_id) THEN
    RAISE EXCEPTION 'Los jugadores de Radar se suman al grupo solo por su propia solicitud.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS radar_guard_membership ON public.group_members;
CREATE TRIGGER radar_guard_membership BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.radar_guard_membership();

-- -----------------------------------------------------------------------------
-- 6. Function privileges: clients may call only the public RPCs, and never as anon
-- -----------------------------------------------------------------------------

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE 'radar\_%' OR p.proname = 'notifications_mark_read')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    IF f.proname IN (
      'radar_set_group_settings', 'radar_publish_match', 'radar_set_listing_status', 'radar_nearby', 'radar_zones',
      'radar_listing_card', 'radar_request_spot', 'radar_decide_request', 'radar_cancel_spot', 'radar_withdraw_request',
      'radar_my_requests', 'radar_admin_requests', 'radar_match_people', 'radar_group_outsiders',
      'radar_ban_requester', 'radar_group_bans_list', 'radar_unban', 'notifications_mark_read') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
