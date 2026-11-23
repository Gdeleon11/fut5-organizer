-- =============================================================================
-- F5 Player Evolution — "validador del partido" for single-admin groups.
-- Additive. Depends on 20261123100000_player_evolution.sql.
--
-- When the only active admin of a group played, nobody can validate their own data. The admin may
-- designate ONE participant of that match as validator. The validator can confirm/reject ONLY the
-- admin's provisional events of that match and resolve corrections about them. Nothing else.
--   - only when the group has no other active admin;
--   - validator: participant of the match, active member, not the admin;
--   - one per match; visible to everyone and logged in the history;
--   - revocable only while unused (no "shopping" for a friendlier validator after a rejection);
--   - ends when the postmatch is closed.
-- No change to roles, group permissions or existing table policies.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.match_validators (
  match_id      uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  validator_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  designated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  used_at       timestamptz,
  revoked_at    timestamptz,
  CONSTRAINT match_validators_not_self CHECK (validator_id <> designated_by)
);
ALTER TABLE public.match_validators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_validators FROM anon, authenticated;
GRANT SELECT ON public.match_validators TO authenticated;
DROP POLICY IF EXISTS match_validators_select_member ON public.match_validators;
CREATE POLICY match_validators_select_member ON public.match_validators FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

ALTER TABLE public.match_event_history DROP CONSTRAINT IF EXISTS match_event_history_action_check;
ALTER TABLE public.match_event_history ADD CONSTRAINT match_event_history_action_check CHECK (action IN (
  'reported', 'updated', 'confirmed', 'rejected', 'correction_requested', 'correction_accepted',
  'correction_dismissed', 'mvp_closed', 'validator_designated', 'validator_revoked'));

-- True when the caller is an admin and the group has no OTHER active admin.
CREATE OR REPLACE FUNCTION public.pe_sole_admin(p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_group_admin(p_group) AND NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = p_group AND gm.is_active AND gm.role IN ('admin', 'super_admin') AND gm.profile_id <> auth.uid());
$$;

-- Active validator row of a match for the caller, for events whose subject is the designating admin.
CREATE OR REPLACE FUNCTION public.pe_validator_ok(p_match uuid, p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_validators v
    WHERE v.match_id = p_match AND v.revoked_at IS NULL AND v.validator_id = auth.uid() AND v.designated_by = p_subject
      AND v.validator_id <> p_subject
      AND NOT EXISTS (SELECT 1 FROM public.match_postmatch x WHERE x.match_id = p_match));
$$;

CREATE OR REPLACE FUNCTION public.postmatch_set_validator(p_match_id uuid, p_validator_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_me uuid := auth.uid(); v_row public.match_validators;
BEGIN
  v_m := public.pe_played_match(p_match_id);
  IF NOT public.is_group_admin(v_m.group_id) THEN RAISE EXCEPTION 'Solo el admin del grupo puede designar un validador.'; END IF;
  IF NOT public.pe_sole_admin(v_m.group_id) THEN RAISE EXCEPTION 'El grupo tiene otro admin: que valide él.'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_postmatch WHERE match_id = p_match_id) THEN RAISE EXCEPTION 'El postpartido ya está cerrado.'; END IF;
  IF NOT public.pe_is_participant(p_match_id, v_me) THEN RAISE EXCEPTION 'Solo hace falta un validador si jugaste el partido.'; END IF;
  IF p_validator_id IS NULL OR p_validator_id = v_me THEN RAISE EXCEPTION 'No podés ser tu propio validador.'; END IF;
  IF NOT public.pe_is_participant(p_match_id, p_validator_id) THEN RAISE EXCEPTION 'El validador tiene que haber jugado este partido.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_m.group_id AND profile_id = p_validator_id AND is_active) THEN
    RAISE EXCEPTION 'El validador tiene que ser un miembro activo del grupo.';
  END IF;
  SELECT * INTO v_row FROM public.match_validators WHERE match_id = p_match_id FOR UPDATE;
  IF FOUND AND v_row.revoked_at IS NULL AND v_row.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'El validador ya revisó datos: no se puede cambiar.';
  END IF;
  INSERT INTO public.match_validators (match_id, group_id, validator_id, designated_by)
  VALUES (p_match_id, v_m.group_id, p_validator_id, v_me)
  ON CONFLICT (match_id) DO UPDATE SET validator_id = EXCLUDED.validator_id, designated_by = EXCLUDED.designated_by,
    created_at = now(), used_at = NULL, revoked_at = NULL;
  PERFORM public.pe_log(p_match_id, v_m.group_id, NULL, NULL, 'validator_designated', jsonb_build_object('subject_id', p_validator_id));
  RETURN jsonb_build_object('validator_id', p_validator_id);
END $$;

CREATE OR REPLACE FUNCTION public.postmatch_revoke_validator(p_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.match_validators;
BEGIN
  SELECT * INTO v_row FROM public.match_validators WHERE match_id = p_match_id AND revoked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay validador designado.'; END IF;
  IF NOT public.is_group_admin(v_row.group_id) THEN RAISE EXCEPTION 'Solo el admin del grupo puede revocarlo.'; END IF;
  IF v_row.used_at IS NOT NULL THEN RAISE EXCEPTION 'El validador ya revisó datos: no se puede revocar.'; END IF;
  UPDATE public.match_validators SET revoked_at = now() WHERE match_id = p_match_id;
  PERFORM public.pe_log(p_match_id, v_row.group_id, NULL, NULL, 'validator_revoked', jsonb_build_object('subject_id', v_row.validator_id));
  RETURN jsonb_build_object('revoked', true);
END $$;

-- postmatch_decide: admins (never their own data) OR the match validator (only the designating admin's data).
CREATE OR REPLACE FUNCTION public.postmatch_decide(p_event_id uuid, p_confirm boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_e public.match_events; v_me uuid := auth.uid(); v_as_validator boolean := false;
BEGIN
  SELECT * INTO v_e FROM public.match_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento no encontrado.'; END IF;
  IF v_e.subject_id = v_me THEN RAISE EXCEPTION 'No podés validar tus propios datos: lo tiene que hacer otro admin.'; END IF;
  IF NOT public.is_group_admin(v_e.group_id) THEN
    IF public.pe_validator_ok(v_e.match_id, v_e.subject_id) THEN v_as_validator := true;
    ELSE RAISE EXCEPTION 'Solo un admin del grupo puede validar.'; END IF;
  END IF;
  UPDATE public.match_events SET status = CASE WHEN p_confirm THEN 'confirmed' ELSE 'rejected' END, decided_by = v_me, decided_at = now(), updated_at = now()
   WHERE id = v_e.id RETURNING * INTO v_e;
  IF v_as_validator THEN UPDATE public.match_validators SET used_at = coalesce(used_at, now()) WHERE match_id = v_e.match_id; END IF;
  PERFORM public.pe_log(v_e.match_id, v_e.group_id, v_e.id, NULL, CASE WHEN p_confirm THEN 'confirmed' ELSE 'rejected' END,
    jsonb_build_object('quantity', v_e.quantity, 'kind', v_e.kind, 'subject_id', v_e.subject_id, 'as_validator', v_as_validator));
  PERFORM public.pe_sync_stats(v_e.match_id, v_e.subject_id);
  RETURN jsonb_build_object('id', v_e.id, 'status', v_e.status, 'as_validator', v_as_validator);
END $$;

-- postmatch_resolve_correction: same rule; the validator only for corrections about the admin's events.
CREATE OR REPLACE FUNCTION public.postmatch_resolve_correction(p_correction_id uuid, p_accept boolean, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c public.match_corrections; v_e public.match_events; v_me uuid := auth.uid(); v_old jsonb; v_as_validator boolean := false;
BEGIN
  SELECT * INTO v_c FROM public.match_corrections WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corrección no encontrada.'; END IF;
  IF v_c.status <> 'open' THEN RAISE EXCEPTION 'La corrección ya fue resuelta.'; END IF;
  IF v_c.event_id IS NOT NULL THEN SELECT * INTO v_e FROM public.match_events WHERE id = v_c.event_id FOR UPDATE; END IF;
  IF NOT public.is_group_admin(v_c.group_id) THEN
    IF v_e.id IS NOT NULL AND public.pe_validator_ok(v_c.match_id, v_e.subject_id) THEN v_as_validator := true;
    ELSE RAISE EXCEPTION 'Solo un admin del grupo puede resolver correcciones.'; END IF;
  END IF;
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
  IF v_as_validator THEN UPDATE public.match_validators SET used_at = coalesce(used_at, now()) WHERE match_id = v_c.match_id; END IF;
  PERFORM public.pe_log(v_c.match_id, v_c.group_id, v_c.event_id, v_c.id, CASE WHEN p_accept THEN 'correction_accepted' ELSE 'correction_dismissed' END,
    jsonb_build_object('before', v_old, 'after', CASE WHEN v_e.id IS NOT NULL THEN jsonb_build_object('quantity', v_e.quantity, 'status', v_e.status) END,
                       'note', v_c.resolution_note, 'as_validator', v_as_validator));
  RETURN jsonb_build_object('id', v_c.id, 'status', v_c.status, 'as_validator', v_as_validator);
END $$;

-- Summary: adds the validator, whether the caller may designate one, and whether the caller is it.
CREATE OR REPLACE FUNCTION public.postmatch_summary(p_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_me uuid := auth.uid(); v_val public.match_validators;
BEGIN
  SELECT * INTO v_m FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR NOT public.is_group_member(v_m.group_id) THEN RAISE EXCEPTION 'Partido no disponible.'; END IF;
  SELECT * INTO v_val FROM public.match_validators WHERE match_id = p_match_id AND revoked_at IS NULL;
  RETURN jsonb_build_object(
    'participants', coalesce((SELECT jsonb_agg(profile_id) FROM public.pe_participants(p_match_id)), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at) FROM public.match_events e WHERE e.match_id = p_match_id), '[]'::jsonb),
    'corrections', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM public.match_corrections c WHERE c.match_id = p_match_id), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC) FROM (SELECT * FROM public.match_event_history WHERE match_id = p_match_id ORDER BY created_at DESC LIMIT 60) h), '[]'::jsonb),
    'mvp', public.pe_mvp_state(p_match_id),
    'my_vote', (SELECT voted_id FROM public.match_mvp_votes WHERE match_id = p_match_id AND voter_id = v_me),
    'closed', (SELECT to_jsonb(x) FROM public.match_postmatch x WHERE x.match_id = p_match_id),
    'legacy_stats', EXISTS (SELECT 1 FROM public.match_player_stats s WHERE s.match_id = p_match_id AND s.source = 'legacy'
                              AND (s.goals > 0 OR s.assists > 0 OR s.clean_sheet OR s.mvp)),
    'validator', CASE WHEN v_val.match_id IS NULL THEN NULL ELSE jsonb_build_object(
                   'validator_id', v_val.validator_id, 'designated_by', v_val.designated_by, 'used', v_val.used_at IS NOT NULL) END,
    'can_designate', public.pe_sole_admin(v_m.group_id) AND public.pe_is_participant(p_match_id, v_me)
                     AND NOT EXISTS (SELECT 1 FROM public.match_postmatch x WHERE x.match_id = p_match_id),
    'i_am_validator', coalesce(v_val.validator_id = v_me, false)
                      AND NOT EXISTS (SELECT 1 FROM public.match_postmatch x WHERE x.match_id = p_match_id));
END $$;

REVOKE ALL ON FUNCTION public.pe_sole_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pe_validator_ok(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.postmatch_set_validator(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.postmatch_revoke_validator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.postmatch_set_validator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.postmatch_revoke_validator(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.postmatch_decide(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.postmatch_resolve_correction(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.postmatch_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.postmatch_decide(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.postmatch_resolve_correction(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.postmatch_summary(uuid) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
