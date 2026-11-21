import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, Pause, Play, Radar as RadarIcon, X } from "lucide-react";
import { api as defaultApi } from "../../api.js";
import Avatar from "../Avatar.jsx";
import { StatusChip } from "../finance/FinanceBlocks.jsx";
import { POSITION_LABELS } from "../../constants.js";
import {
  LEVEL_OPTIONS, RADAR_POSITIONS, listingStatusLabel, publishBlockers, relativeTime, requestStatus, validatePublishForm,
} from "../../radar/radarModel.js";

const TONE = { ok: "paid", warn: "pending", bad: "rejected", muted: "forgiven" };
const LISTING_TONE = { open: "paid", paused: "pending", closed: "forgiven" };

/**
 * Admin-only Radar controls for one match: publish / pause / close and the requests inbox.
 * onApproved(result) lets the app re-run the existing fee split (upsertMatchFee) and reload data.
 */
export default function RadarAdminPanel({ match, venue, groupId, occupancy = 0, radarApi = defaultApi, onApproved, onChanged }) {
  const [settings, setSettings] = useState(null);
  const [listing, setListing] = useState(undefined);
  const [requests, setRequests] = useState([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [form, setForm] = useState({ radarSlots: 1, levelBand: "any", positions: [], zoneLabel: "", note: "" });

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([radarApi.getRadarGroupSettings(groupId), radarApi.getRadarListingForMatch(match.id)]);
      setSettings(s); setListing(l);
      if (l) {
        setForm({ radarSlots: l.radar_slots, levelBand: l.level_band, positions: l.positions || [], zoneLabel: l.zone_label, note: l.note || "" });
        setRequests(await radarApi.radarAdminRequests(match.id));
      } else {
        setRequests([]);
      }
    } catch (e) { setError(e.message); }
  }, [radarApi, groupId, match.id]);
  useEffect(() => { load(); }, [load]);

  const freeSlots = Math.max(0, (Number(match.max_players) || 0) - occupancy);
  const approved = requests.filter((r) => r.status === "approved").length;
  const pending = requests.filter((r) => r.status === "pending");
  const others = requests.filter((r) => r.status !== "pending");
  const blockers = useMemo(() => publishBlockers({ match, venue, radarEnabled: !!settings?.enabled }), [match, venue, settings]);
  const radarFull = listing && approved >= listing.radar_slots;
  const matchFull = freeSlots <= 0;

  async function run(fn, ok) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); if (ok) setNotice(ok); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function publish(e) {
    e.preventDefault();
    const invalid = validatePublishForm({ ...form, freeSlots: freeSlots + approved });
    if (invalid) { setError(invalid); return; }
    run(async () => { await radarApi.publishRadarMatch(match.id, form); setEditing(false); }, listing ? "Publicación actualizada." : "Partido publicado en Radar.");
  }

  function decide(r, approve) {
    run(async () => {
      const result = await radarApi.radarDecideRequest(r.request_id, approve, approve ? null : rejectNote.trim());
      setRejecting(null); setRejectNote("");
      if (approve) await onApproved?.(result);
    }, approve ? `${r.nickname} se sumó al partido.` : "Solicitud rechazada.");
  }

  const togglePosition = (p) => setForm((f) => ({ ...f, positions: f.positions.includes(p) ? f.positions.filter((x) => x !== p) : [...f.positions, p] }));
  const status = listing?.status;

  return (
    <section className="rd-admin fx-section" aria-label="Radar" data-radar-panel>
      <div className="mdd-head fx-head">
        <h2><RadarIcon size={17} aria-hidden="true" /> Radar</h2>
        <div className="fx-head-aside">
          <StatusChip tone={status ? LISTING_TONE[status] : "forgiven"}>{status ? `En Radar · ${listingStatusLabel(status)}` : "Privado"}</StatusChip>
        </div>
      </div>
      {error && <p className="form-message" role="alert">{error}</p>}
      {notice && <p className="rd-ok" role="status">{notice}</p>}
      {listing === undefined && <p className="fx-empty" role="status">Cargando…</p>}

      {listing !== undefined && (
        <>
          {status && !editing && (
            <div className="rd-admin-summary">
              <p><b>{approved}/{listing.radar_slots}</b> cupos Radar ocupados · {pending.length} pendientes · zona “{listing.zone_label}”</p>
              <div className="rd-admin-actions">
                {status !== "closed" && <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={() => setEditing(true)}>Editar</button>}
                {status === "open" && <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={() => run(() => radarApi.setRadarListingStatus(listing.id, "paused"), "Publicación pausada.")}><Pause size={15} aria-hidden="true" /> Pausar</button>}
                {status === "paused" && <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={() => run(() => radarApi.setRadarListingStatus(listing.id, "open"), "Publicación reabierta.")}><Play size={15} aria-hidden="true" /> Reabrir</button>}
                {status !== "closed" && <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={() => run(() => radarApi.setRadarListingStatus(listing.id, "closed"), "Publicación cerrada. El partido vuelve a ser privado.")}><X size={15} aria-hidden="true" /> Volver a privado</button>}
                {status === "closed" && blockers.length === 0 && <button type="button" className="md-btn md-btn-accent" onClick={() => setEditing(true)}>Publicar de nuevo</button>}
              </div>
            </div>
          )}

          {!status && !editing && (
            blockers.length > 0 ? (
              <ul className="rd-blockers" aria-label="No se puede publicar">
                {blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            ) : (
              <div className="rd-admin-summary">
                <p>El partido es privado. Publicalo en Radar para que jugadores de otros grupos pidan un cupo; vos aceptás cada solicitud.</p>
                <button type="button" className="md-btn md-btn-accent" onClick={() => setEditing(true)}><RadarIcon size={15} aria-hidden="true" /> Publicar en Radar</button>
              </div>
            )
          )}

          {editing && (
            <form className="md-form rd-publish" onSubmit={publish} aria-label="Publicar en Radar">
              <label>Cupos para Radar
                <input type="number" min={1} value={form.radarSlots}
                  onChange={(e) => setForm((f) => ({ ...f, radarSlots: e.target.value }))} />
                <small>Libres en el partido: {freeSlots}</small>
              </label>
              <label>Nivel
                <select value={form.levelBand} onChange={(e) => setForm((f) => ({ ...f, levelBand: e.target.value }))}>
                  {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label>Zona visible
                <input value={form.zoneLabel} maxLength={60} placeholder={venue?.name || "Ej. Zona 10"} onChange={(e) => setForm((f) => ({ ...f, zoneLabel: e.target.value }))} />
                <small>Se muestra antes de aceptar; la dirección exacta solo a los aceptados.</small>
              </label>
              <fieldset className="md-form-group md-form-wide rd-positions">
                <legend>Posiciones que buscás (opcional)</legend>
                {RADAR_POSITIONS.map((p) => (
                  <label key={p} className="rd-check"><input type="checkbox" checked={form.positions.includes(p)} onChange={() => togglePosition(p)} /> {POSITION_LABELS[p] || p}</label>
                ))}
              </fieldset>
              <label className="md-form-wide">Nota (opcional)
                <input value={form.note} maxLength={200} placeholder="Ej. Buscamos portero, cancha techada." onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </label>
              <p className="rd-privacy md-form-wide">No se publica el nombre del partido, la lista del grupo ni datos de contacto.</p>
              <div className="rd-admin-actions md-form-wide">
                <button type="submit" className="md-btn md-btn-accent" disabled={busy}>{listing && status !== "closed" ? "Guardar" : "Publicar"}</button>
                <button type="button" className="md-btn md-btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
              </div>
            </form>
          )}

          {listing && (
            <div className="rd-inbox" aria-label="Solicitudes Radar">
              <h3>Solicitudes {pending.length > 0 && <span className="rd-count-badge">{pending.length}</span>}</h3>
              {requests.length === 0 && <p className="fx-empty">Todavía no hay solicitudes.</p>}
              <ul>
                {[...pending, ...others].map((r) => {
                  const s = requestStatus(r.status);
                  return (
                    <li key={r.request_id} className="rd-inbox-item" data-status={r.status}>
                      <Avatar profile={{ nickname: r.nickname, avatar_url: r.avatar_url }} size="sm" />
                      <div className="rd-inbox-main">
                        <b>{r.nickname}</b>
                        <small>{POSITION_LABELS[r.position] || POSITION_LABELS[r.preferred_position] || "Flexible"} · {relativeTime(r.created_at)}</small>
                        {r.message && <p>“{r.message}”</p>}
                        {r.late_cancel && <small className="rd-fine">Canceló tarde</small>}
                      </div>
                      {r.status === "pending" ? (
                        rejecting === r.request_id ? (
                          <div className="rd-reject">
                            <label>Nota (opcional)
                              <input value={rejectNote} maxLength={200} onChange={(e) => setRejectNote(e.target.value)} placeholder="Ej. Ya completamos" />
                            </label>
                            <button type="button" className="md-btn md-btn-accent" disabled={busy} onClick={() => decide(r, false)}>Rechazar</button>
                            <button type="button" className="md-btn md-btn-ghost" onClick={() => setRejecting(null)}>Volver</button>
                          </div>
                        ) : (
                          <div className="rd-inbox-actions">
                            <button type="button" className="md-btn md-btn-accent" disabled={busy || radarFull || matchFull}
                              title={radarFull ? "Cupos Radar completos" : matchFull ? "Partido lleno" : undefined}
                              onClick={() => decide(r, true)} aria-label={`Aceptar a ${r.nickname}`}><Check size={15} aria-hidden="true" /> Aceptar</button>
                            <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={() => setRejecting(r.request_id)} aria-label={`Rechazar a ${r.nickname}`}><X size={15} aria-hidden="true" /> Rechazar</button>
                            <button type="button" className="md-btn md-btn-ghost" disabled={busy}
                              onClick={() => { if (window.confirm(`¿Bloquear a ${r.nickname} para los partidos del grupo?`)) run(() => radarApi.radarBanRequester(r.request_id), `${r.nickname} fue bloqueado en Radar.`); }}
                              aria-label={`Bloquear a ${r.nickname}`}><Ban size={15} aria-hidden="true" /></button>
                          </div>
                        )
                      ) : (
                        <StatusChip tone={TONE[s.tone]}>{s.label}</StatusChip>
                      )}
                    </li>
                  );
                })}
              </ul>
              {(radarFull || matchFull) && pending.length > 0 && <p className="rd-privacy">{matchFull ? "El partido está lleno." : "Ya cubriste los cupos de Radar."} Podés ampliar los cupos en Editar o rechazar las solicitudes.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
