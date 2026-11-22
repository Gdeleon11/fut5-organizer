-- =============================================================================
-- F5 Player Evolution — Player Builder (A) and Postmatch (B).
-- Additive: new tables/functions plus two TIGHTENED policies on match_player_stats.
-- Nothing is dropped from existing data; historical stats, ratings and votes are untouched.
--
-- A. player_styles: self-declared style (secondary position + 10 points). Self-declared only:
--    it never changes player_ratings (official rating) nor match_player_stats.
-- B. Postmatch: events reported per match (provisional → confirmed/rejected), correction
--    requests, an append-only history, and MVP votes among real participants.
--    Official stats (match_player_stats) are written only by the SECURITY DEFINER functions here,
--    from confirmed events. Nobody can confirm an event that benefits themselves.
--
-- Policy changes (tightening, documented in docs/F5_PLAYER_EVOLUTION.md):
--    - match_player_stats_manage_own  → dropped: players could write their own official goals/MVP.
--    - match_player_stats_manage_admin → admins can no longer write their OWN row directly.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------- A. Player style
CREATE TABLE IF NOT EXISTS public.player_styles (
  profile_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  secondary_position  text CHECK (secondary_position IS NULL OR secondary_position IN ('Flexible', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward')),
  attack              smallint NOT NULL DEFAULT 0 CHECK (attack BETWEEN 0 AND 10),
  defense             smallint NOT NULL DEFAULT 0 CHECK (defense BETWEEN 0 AND 10),
  passing             smallint NOT NULL DEFAULT 0 CHECK (passing BETWEEN 0 AND 10),
  pace                smallint NOT NULL DEFAULT 0 CHECK (pace BETWEEN 0 AND 10),
  goalkeeping         smallint NOT NULL DEFAULT 0 CHECK (goalkeeping BETWEEN 0 AND 10),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_styles_ten_points CHECK (attack + defense + passing + pace + goalkeeping = 10)
);

ALTER TABLE public.player_styles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_styles FROM anon;
DROP POLICY IF EXISTS player_styles_select ON public.player_styles;
CREATE POLICY player_styles_select ON public.player_styles FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.shares_group_with(profile_id));
DROP POLICY IF EXISTS player_styles_insert_own ON public.player_styles;
CREATE POLICY player_styles_insert_own ON public.player_styles FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS player_styles_update_own ON public.player_styles;
CREATE POLICY player_styles_update_own ON public.player_styles FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.player_styles TO authenticated;

CREATE OR REPLACE FUNCTION public.player_styles_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS player_styles_touch ON public.player_styles;
CREATE TRIGGER player_styles_touch BEFORE UPDATE ON public.player_styles FOR EACH ROW EXECUTE FUNCTION public.player_styles_touch();

-- ---------------------------------------------------------------- B. Postmatch tables
ALTER TABLE public.match_player_stats ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy';
COMMENT ON COLUMN public.match_player_stats.source IS 'legacy = entered before Postmatch (never overwritten); postmatch = derived from confirmed match_events.';

CREATE TABLE IF NOT EXISTS public.match_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('goal', 'assist', 'clean_sheet')),
  quantity      smallint NOT NULL CHECK (quantity BETWEEN 0 AND 20),
  status        text NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional', 'confirmed', 'rejected')),
  reported_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, subject_id, kind)
);
CREATE INDEX IF NOT EXISTS match_events_match_idx ON public.match_events (match_id);

CREATE TABLE IF NOT EXISTS public.match_corrections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES public.match_events(id) ON DELETE CASCADE,
  requested_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message       text NOT NULL CHECK (char_length(message) BETWEEN 3 AND 280),
  proposed_quantity smallint CHECK (proposed_quantity IS NULL OR proposed_quantity BETWEEN 0 AND 20),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed')),
  resolved_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at   timestamptz,
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 200),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_corrections_match_idx ON public.match_corrections (match_id);

CREATE TABLE IF NOT EXISTS public.match_event_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id    uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  event_id    uuid,
  correction_id uuid,
  action      text NOT NULL CHECK (action IN ('reported', 'updated', 'confirmed', 'rejected', 'correction_requested', 'correction_accepted', 'correction_dismissed', 'mvp_closed')),
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_event_history_match_idx ON public.match_event_history (match_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.match_mvp_votes (
  match_id    uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  voter_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voted_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, voter_id),
  CONSTRAINT match_mvp_no_self_vote CHECK (voter_id <> voted_id)
);

CREATE TABLE IF NOT EXISTS public.match_postmatch (
  match_id      uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  mvp_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mvp_votes     integer,
  voters        integer,
  participants  integer,
  closed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at     timestamptz NOT NULL DEFAULT now()
);

-- Read-only for group members; every write goes through the functions below.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['match_events', 'match_corrections', 'match_event_history', 'match_mvp_votes', 'match_postmatch'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_member', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_group_member(group_id))', t || '_select_member', t);
  END LOOP;
END $$;

-- Tighten official stats: no self-written rows (players), no own row for admins.
DROP POLICY IF EXISTS match_player_stats_manage_own ON public.match_player_stats;
DROP POLICY IF EXISTS match_player_stats_manage_admin ON public.match_player_stats;
CREATE POLICY match_player_stats_manage_admin ON public.match_player_stats
  FOR ALL TO authenticated
  USING (public.is_group_admin(group_id) AND player_id IS DISTINCT FROM auth.uid())
  WITH CHECK (public.is_group_admin(group_id) AND player_id IS DISTINCT FROM auth.uid());

-- ---------------------------------------------------------------- B. Helpers (internal)
-- Real lineup: generated team members if any; else checked-in; else confirmed attendances.
CREATE OR REPLACE FUNCTION public.pe_participants(p_match_id uuid)
RETURNS TABLE (profile_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH tm AS (
    SELECT DISTINCT m.profile_id FROM public.team_members m JOIN public.teams t ON t.id = m.team_id
    WHERE t.match_id = p_match_id AND m.profile_id IS NOT NULL
  ), ci AS (
    SELECT a.profile_id FROM public.attendances a
    WHERE a.match_id = p_match_id AND (a.status = 'checked_in' OR (a.status = 'confirmed' AND a.checked_in))
  ), cf AS (
    SELECT a.profile_id FROM public.attendances a WHERE a.match_id = p_match_id AND a.status IN ('confirmed', 'checked_in')
  )
  SELECT profile_id FROM tm
  UNION SELECT profile_id FROM ci WHERE NOT EXISTS (SELECT 1 FROM tm)
  UNION SELECT profile_id FROM cf WHERE NOT EXISTS (SELECT 1 FROM tm) AND NOT EXISTS (SELECT 1 FROM ci);
$$;

CREATE OR REPLACE FUNCTION public.pe_is_participant(p_match_id uuid, p_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pe_participants(p_match_id) x WHERE x.profile_id = p_profile);
$$;

-- Match must exist, not be canceled, and have started (America/Guatemala).
CREATE OR REPLACE FUNCTION public.pe_played_match(p_match_id uuid)
RETURNS public.matches LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.matches; v_start timestamptz;
BEGIN
  SELECT * INTO v FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado.'; END IF;
  IF v.status = 'canceled' THEN RAISE EXCEPTION 'El partido fue cancelado.'; END IF;
  v_start := ((v.match_date::text || ' ' || coalesce(substring(v.start_time from '^\d{1,2}:\d{2}'), '00:00'))::timestamp AT TIME ZONE 'America/Guatemala');
  IF v_start > now() THEN RAISE EXCEPTION 'El partido todavía no se jugó.'; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.pe_log(p_match uuid, p_group uuid, p_event uuid, p_corr uuid, p_action text, p_detail jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.match_event_history (match_id, group_id, event_id, correction_id, action, actor_id, detail)
  VALUES (p_match, p_group, p_event, p_corr, p_action, auth.uid(), coalesce(p_detail, '{}'::jsonb));
$$;

-- Official stats row from confirmed events. Never overwrites a legacy row with data in it.
CREATE OR REPLACE FUNCTION public.pe_sync_stats(p_match uuid, p_subject uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group uuid; v_goals int; v_assists int; v_cs boolean; v_row public.match_player_stats; v_mvp boolean;
BEGIN
  SELECT group_id INTO v_group FROM public.matches WHERE id = p_match;
  SELECT coalesce(sum(quantity) FILTER (WHERE kind = 'goal'), 0), coalesce(sum(quantity) FILTER (WHERE kind = 'assist'), 0),
         coalesce(bool_or(quantity > 0) FILTER (WHERE kind = 'clean_sheet'), false)
    INTO v_goals, v_assists, v_cs
    FROM public.match_events WHERE match_id = p_match AND subject_id = p_subject AND status = 'confirmed';
  v_mvp := EXISTS (SELECT 1 FROM public.match_postmatch WHERE match_id = p_match AND mvp_profile_id = p_subject);
  SELECT * INTO v_row FROM public.match_player_stats WHERE match_id = p_match AND player_id = p_subject;
  IF FOUND AND v_row.source = 'legacy' AND (v_row.goals > 0 OR v_row.assists > 0 OR v_row.clean_sheet OR v_row.mvp) THEN
    RETURN false;  -- keep the historical row untouched
  END IF;
  IF FOUND THEN
    UPDATE public.match_player_stats SET goals = v_goals, assists = v_assists, clean_sheet = v_cs, mvp = v_mvp, source = 'postmatch'
     WHERE id = v_row.id;
  ELSIF v_goals > 0 OR v_assists > 0 OR v_cs OR v_mvp THEN
    INSERT INTO public.match_player_stats (group_id, match_id, player_id, goals, assists, clean_sheet, mvp, created_by, source)
    VALUES (v_group, p_match, p_subject, v_goals, v_assists, v_cs, v_mvp, auth.uid(), 'postmatch');
  END IF;
  RETURN true;
END $$;

-- ---------------------------------------------------------------- B. Client functions
-- Report (or update) an event. Admin reporting someone else → confirmed; anything else → provisional.
CREATE OR REPLACE FUNCTION public.postmatch_report(p_match_id uuid, p_subject_id uuid, p_kind text, p_quantity integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_me uuid := auth.uid(); v_admin boolean; v_e public.match_events; v_status text; v_old jsonb;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Iniciá sesión.'; END IF;
  v_m := public.pe_played_match(p_match_id);
  PERFORM 1 FROM public.matches WHERE id = p_match_id FOR UPDATE;
  v_admin := public.is_group_admin(v_m.group_id);
  IF NOT v_admin AND NOT public.pe_is_participant(p_match_id, v_me) THEN RAISE EXCEPTION 'Solo los jugadores del partido pueden registrar eventos.'; END IF;
  IF NOT public.pe_is_participant(p_match_id, p_subject_id) THEN RAISE EXCEPTION 'Ese jugador no figura en la alineación del partido.'; END IF;
  IF p_kind NOT IN ('goal', 'assist', 'clean_sheet') THEN RAISE EXCEPTION 'Tipo de evento no válido.'; END IF;
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 20 OR (p_kind = 'clean_sheet' AND p_quantity > 1) THEN RAISE EXCEPTION 'Cantidad no válida.'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_postmatch WHERE match_id = p_match_id) AND NOT v_admin THEN
    RAISE EXCEPTION 'El postpartido ya se cerró. Pedí una corrección.';
  END IF;
  v_status := CASE WHEN v_admin AND p_subject_id <> v_me THEN 'confirmed' ELSE 'provisional' END;

  SELECT * INTO v_e FROM public.match_events WHERE match_id = p_match_id AND subject_id = p_subject_id AND kind = p_kind FOR UPDATE;
  IF FOUND THEN
    IF v_e.status = 'confirmed' AND v_status <> 'confirmed' THEN
      RAISE EXCEPTION 'Ese dato ya está confirmado. Si está mal, pedí una corrección.';
    END IF;
    v_old := jsonb_build_object('quantity', v_e.quantity, 'status', v_e.status);
    UPDATE public.match_events SET quantity = p_quantity, status = v_status, reported_by = v_me,
      decided_by = CASE WHEN v_status = 'confirmed' THEN v_me END, decided_at = CASE WHEN v_status = 'confirmed' THEN now() END, updated_at = now()
     WHERE id = v_e.id RETURNING * INTO v_e;
    PERFORM public.pe_log(p_match_id, v_m.group_id, v_e.id, NULL, 'updated', jsonb_build_object('before', v_old, 'after', jsonb_build_object('quantity', p_quantity, 'status', v_status)));
  ELSE
    INSERT INTO public.match_events (match_id, group_id, subject_id, kind, quantity, status, reported_by, decided_by, decided_at)
    VALUES (p_match_id, v_m.group_id, p_subject_id, p_kind, p_quantity, v_status, v_me,
            CASE WHEN v_status = 'confirmed' THEN v_me END, CASE WHEN v_status = 'confirmed' THEN now() END)
    RETURNING * INTO v_e;
    PERFORM public.pe_log(p_match_id, v_m.group_id, v_e.id, NULL, 'reported', jsonb_build_object('kind', p_kind, 'quantity', p_quantity, 'status', v_status, 'subject_id', p_subject_id));
  END IF;
  PERFORM public.pe_sync_stats(p_match_id, p_subject_id);
  RETURN jsonb_build_object('id', v_e.id, 'status', v_e.status, 'quantity', v_e.quantity);
END $$;

-- Admin confirms or rejects a provisional event. Never their own.
CREATE OR REPLACE FUNCTION public.postmatch_decide(p_event_id uuid, p_confirm boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_e public.match_events; v_me uuid := auth.uid();
BEGIN
  SELECT * INTO v_e FROM public.match_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento no encontrado.'; END IF;
  IF NOT public.is_group_admin(v_e.group_id) THEN RAISE EXCEPTION 'Solo un admin del grupo puede validar.'; END IF;
  IF v_e.subject_id = v_me THEN RAISE EXCEPTION 'No podés validar tus propios datos: lo tiene que hacer otro admin.'; END IF;
  UPDATE public.match_events SET status = CASE WHEN p_confirm THEN 'confirmed' ELSE 'rejected' END, decided_by = v_me, decided_at = now(), updated_at = now()
   WHERE id = v_e.id RETURNING * INTO v_e;
  PERFORM public.pe_log(v_e.match_id, v_e.group_id, v_e.id, NULL, CASE WHEN p_confirm THEN 'confirmed' ELSE 'rejected' END, jsonb_build_object('quantity', v_e.quantity, 'kind', v_e.kind, 'subject_id', v_e.subject_id));
  PERFORM public.pe_sync_stats(v_e.match_id, v_e.subject_id);
  RETURN jsonb_build_object('id', v_e.id, 'status', v_e.status);
END $$;

CREATE OR REPLACE FUNCTION public.postmatch_request_correction(p_match_id uuid, p_event_id uuid, p_message text, p_proposed integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_me uuid := auth.uid(); v_c public.match_corrections;
BEGIN
  SELECT * INTO v_m FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado.'; END IF;
  IF NOT (public.pe_is_participant(p_match_id, v_me) OR public.is_group_admin(v_m.group_id)) THEN RAISE EXCEPTION 'Solo los jugadores del partido pueden pedir correcciones.'; END IF;
  IF p_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.match_events WHERE id = p_event_id AND match_id = p_match_id) THEN RAISE EXCEPTION 'Evento no encontrado.'; END IF;
  IF (SELECT count(*) FROM public.match_corrections WHERE match_id = p_match_id AND requested_by = v_me AND status = 'open') >= 5 THEN
    RAISE EXCEPTION 'Ya tenés 5 correcciones abiertas en este partido.';
  END IF;
  INSERT INTO public.match_corrections (match_id, group_id, event_id, requested_by, message, proposed_quantity)
  VALUES (p_match_id, v_m.group_id, p_event_id, v_me, trim(p_message), p_proposed) RETURNING * INTO v_c;
  PERFORM public.pe_log(p_match_id, v_m.group_id, p_event_id, v_c.id, 'correction_requested', jsonb_build_object('message', v_c.message, 'proposed', p_proposed));
  RETURN jsonb_build_object('id', v_c.id, 'status', v_c.status);
END $$;

-- Admin resolves a correction; accepting one that changes their own data is refused.
CREATE OR REPLACE FUNCTION public.postmatch_resolve_correction(p_correction_id uuid, p_accept boolean, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c public.match_corrections; v_e public.match_events; v_me uuid := auth.uid(); v_old jsonb;
BEGIN
  SELECT * INTO v_c FROM public.match_corrections WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corrección no encontrada.'; END IF;
  IF NOT public.is_group_admin(v_c.group_id) THEN RAISE EXCEPTION 'Solo un admin del grupo puede resolver correcciones.'; END IF;
  IF v_c.status <> 'open' THEN RAISE EXCEPTION 'La corrección ya fue resuelta.'; END IF;
  IF v_c.event_id IS NOT NULL THEN SELECT * INTO v_e FROM public.match_events WHERE id = v_c.event_id FOR UPDATE; END IF;
  IF p_accept AND v_e.id IS NOT NULL AND v_e.subject_id = v_me THEN
    RAISE EXCEPTION 'Esta corrección cambia tus propios datos: la tiene que resolver otro admin.';
  END IF;
  IF p_accept AND v_e.id IS NOT NULL AND v_c.proposed_quantity IS NOT NULL THEN
    v_old := jsonb_build_object('quantity', v_e.quantity, 'status', v_e.status);
    UPDATE public.match_events SET quantity = v_c.proposed_quantity,
      status = CASE WHEN v_c.proposed_quantity = 0 THEN 'rejected' ELSE 'confirmed' END,
      decided_by = v_me, decided_at = now(), updated_at = now()
     WHERE id = v_e.id RETURNING * INTO v_e;
    PERFORM public.pe_sync_stats(v_e.match_id, v_e.subject_id);
  END IF;
  UPDATE public.match_corrections SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'dismissed' END,
    resolved_by = v_me, resolved_at = now(), resolution_note = nullif(trim(coalesce(p_note, '')), '')
   WHERE id = v_c.id RETURNING * INTO v_c;
  PERFORM public.pe_log(v_c.match_id, v_c.group_id, v_c.event_id, v_c.id, CASE WHEN p_accept THEN 'correction_accepted' ELSE 'correction_dismissed' END,
    jsonb_build_object('before', v_old, 'after', CASE WHEN v_e.id IS NOT NULL THEN jsonb_build_object('quantity', v_e.quantity, 'status', v_e.status) END, 'note', v_c.resolution_note));
  RETURN jsonb_build_object('id', v_c.id, 'status', v_c.status);
END $$;

-- One MVP vote per participant per match (changeable until closed); never for yourself.
CREATE OR REPLACE FUNCTION public.postmatch_vote_mvp(p_match_id uuid, p_voted_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Iniciá sesión.'; END IF;
  v_m := public.pe_played_match(p_match_id);
  IF EXISTS (SELECT 1 FROM public.match_postmatch WHERE match_id = p_match_id) THEN RAISE EXCEPTION 'La votación ya se cerró.'; END IF;
  IF NOT public.pe_is_participant(p_match_id, v_me) THEN RAISE EXCEPTION 'Solo votan los jugadores del partido.'; END IF;
  IF p_voted_id = v_me THEN RAISE EXCEPTION 'No podés votarte a vos mismo.'; END IF;
  IF NOT public.pe_is_participant(p_match_id, p_voted_id) THEN RAISE EXCEPTION 'Ese jugador no figura en la alineación del partido.'; END IF;
  INSERT INTO public.match_mvp_votes (match_id, group_id, voter_id, voted_id)
  VALUES (p_match_id, v_m.group_id, v_me, p_voted_id)
  ON CONFLICT (match_id, voter_id) DO UPDATE SET voted_id = EXCLUDED.voted_id, updated_at = now();
  RETURN jsonb_build_object('voted_id', p_voted_id);
END $$;

-- Quorum rule: at least max(3, ceil(participants / 2)) voters and a single leader.
CREATE OR REPLACE FUNCTION public.pe_mvp_state(p_match_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (SELECT count(*)::int n FROM public.pe_participants(p_match_id)),
  v AS (SELECT voted_id, count(*)::int c FROM public.match_mvp_votes WHERE match_id = p_match_id GROUP BY voted_id),
  t AS (SELECT coalesce(sum(c), 0)::int voters, coalesce(max(c), 0)::int top FROM v)
  SELECT jsonb_build_object(
    'participants', p.n, 'voters', t.voters, 'quorum', greatest(3, ceil(p.n / 2.0)::int),
    'leaders', coalesce((SELECT jsonb_agg(voted_id) FROM v WHERE v.c = t.top AND t.top > 0), '[]'::jsonb),
    'top_votes', t.top)
  FROM p, t;
$$;

CREATE OR REPLACE FUNCTION public.postmatch_close(p_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_s jsonb; v_winner uuid;
BEGIN
  v_m := public.pe_played_match(p_match_id);
  IF NOT public.is_group_admin(v_m.group_id) THEN RAISE EXCEPTION 'Solo un admin del grupo puede cerrar el postpartido.'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_postmatch WHERE match_id = p_match_id) THEN RAISE EXCEPTION 'El postpartido ya está cerrado.'; END IF;
  v_s := public.pe_mvp_state(p_match_id);
  IF (v_s->>'voters')::int >= (v_s->>'quorum')::int AND jsonb_array_length(v_s->'leaders') = 1 THEN
    v_winner := (v_s->'leaders'->>0)::uuid;
  END IF;
  INSERT INTO public.match_postmatch (match_id, group_id, mvp_profile_id, mvp_votes, voters, participants, closed_by)
  VALUES (p_match_id, v_m.group_id, v_winner, CASE WHEN v_winner IS NOT NULL THEN (v_s->>'top_votes')::int END,
          (v_s->>'voters')::int, (v_s->>'participants')::int, auth.uid());
  IF v_winner IS NOT NULL THEN PERFORM public.pe_sync_stats(p_match_id, v_winner); END IF;
  PERFORM public.pe_log(p_match_id, v_m.group_id, NULL, NULL, 'mvp_closed', jsonb_build_object('mvp', v_winner, 'state', v_s));
  RETURN jsonb_build_object('mvp_profile_id', v_winner, 'state', v_s);
END $$;

-- Everything the Postmatch screen needs, for group members.
CREATE OR REPLACE FUNCTION public.postmatch_summary(p_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_me uuid := auth.uid();
BEGIN
  SELECT * INTO v_m FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR NOT public.is_group_member(v_m.group_id) THEN RAISE EXCEPTION 'Partido no disponible.'; END IF;
  RETURN jsonb_build_object(
    'participants', coalesce((SELECT jsonb_agg(profile_id) FROM public.pe_participants(p_match_id)), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at) FROM public.match_events e WHERE e.match_id = p_match_id), '[]'::jsonb),
    'corrections', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM public.match_corrections c WHERE c.match_id = p_match_id), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC) FROM (SELECT * FROM public.match_event_history WHERE match_id = p_match_id ORDER BY created_at DESC LIMIT 60) h), '[]'::jsonb),
    'mvp', public.pe_mvp_state(p_match_id),
    'my_vote', (SELECT voted_id FROM public.match_mvp_votes WHERE match_id = p_match_id AND voter_id = v_me),
    'closed', (SELECT to_jsonb(x) FROM public.match_postmatch x WHERE x.match_id = p_match_id),
    'legacy_stats', EXISTS (SELECT 1 FROM public.match_player_stats s WHERE s.match_id = p_match_id AND s.source = 'legacy'
                              AND (s.goals > 0 OR s.assists > 0 OR s.clean_sheet OR s.mvp)));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['pe_participants(uuid)', 'pe_is_participant(uuid,uuid)', 'pe_played_match(uuid)', 'pe_log(uuid,uuid,uuid,uuid,text,jsonb)',
                           'pe_sync_stats(uuid,uuid)', 'pe_mvp_state(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['postmatch_report(uuid,uuid,text,integer)', 'postmatch_decide(uuid,boolean)', 'postmatch_request_correction(uuid,uuid,text,integer)',
                           'postmatch_resolve_correction(uuid,boolean,text)', 'postmatch_vote_mvp(uuid,uuid)', 'postmatch_close(uuid)', 'postmatch_summary(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
