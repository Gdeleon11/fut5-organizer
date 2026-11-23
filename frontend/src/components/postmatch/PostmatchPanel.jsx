import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, Crown, History, MessageSquareWarning, Minus, Plus, UserCheck, X } from "lucide-react";
import { api as defaultApi } from "../../api.js";
import { StatusChip } from "../finance/FinanceBlocks.jsx";
import { KINDS, STATUS, canResolve, decidable, historyLine, kindLabel, mvpView, needsValidator, rows } from "../../postmatch/postmatchModel.js";
import { displayName } from "../../utils.js";

function Stepper({ label, value, onChange, max = 20 }) {
  return (
    <span className="mdd-stepper" role="group" aria-label={label}>
      <small>{label}</small>
      <button type="button" aria-label={`Restar ${label}`} onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}><Minus size={16} aria-hidden="true" /></button>
      <b>{value}</b>
      <button type="button" aria-label={`Sumar ${label}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}><Plus size={16} aria-hidden="true" /></button>
    </span>
  );
}

/** Report goals/assists/clean sheet for one player (self → provisional; admin for others → confirmed). */
function ReportForm({ subjectId, subjects, nameOf, current, selfReport, onSubmit, onCancel }) {
  const [who, setWho] = useState(subjectId || subjects[0] || "");
  const val = (id, k) => current(id, k)?.quantity ?? 0;
  const [goals, setGoals] = useState(val(who, "goal"));
  const [assists, setAssists] = useState(val(who, "assist"));
  const [clean, setClean] = useState(val(who, "clean_sheet") > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setGoals(val(who, "goal")); setAssists(val(who, "assist")); setClean(val(who, "clean_sheet") > 0); }, [who]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    const err = await onSubmit(who, { goal: goals, assist: assists, clean_sheet: clean ? 1 : 0 });
    if (err) { setError(err); setBusy(false); }
  }
  return (
    <form className="pm-report" onSubmit={submit} aria-label="Cargar datos del partido">
      {!subjectId && (
        <label>Jugador
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            {subjects.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
          </select>
        </label>
      )}
      <div className="pm-steppers">
        <Stepper label="Goles" value={goals} onChange={setGoals} />
        <Stepper label="Asistencias" value={assists} onChange={setAssists} />
        <label className="pm-check"><input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} /> Valla invicta</label>
      </div>
      {selfReport && <p className="fx-hint">Queda <b>pendiente</b> hasta que un admin (que no seas vos) lo valide. Recién ahí cuenta en tus estadísticas.</p>}
      {error && <p className="form-message" role="alert">{error}</p>}
      <div className="pm-actions">
        <button type="button" className="md-btn md-btn-ghost fx-btn-sm" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="submit" className="md-btn md-btn-accent fx-btn-sm" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
      </div>
    </form>
  );
}

function CorrectionForm({ events, nameOf, onSubmit, onCancel }) {
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [proposed, setProposed] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (message.trim().length < 3) { setError("Contá brevemente qué está mal."); return; }
    setBusy(true); setError("");
    const err = await onSubmit(eventId || null, message.trim(), proposed === "" ? null : Number(proposed));
    if (err) { setError(err); setBusy(false); }
  }
  return (
    <form className="pm-correction" onSubmit={submit} aria-label="Pedir corrección">
      <label>¿Qué dato?
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((e) => <option key={e.id} value={e.id}>{nameOf(e.subject_id)} · {e.quantity} {kindLabel(e.kind, e.quantity)} ({STATUS[e.status]?.label})</option>)}
          <option value="">Otro (falta un dato)</option>
        </select>
      </label>
      {eventId && (
        <label>Valor correcto <small>(opcional)</small>
          <input type="number" min="0" max="20" inputMode="numeric" value={proposed} onChange={(e) => setProposed(e.target.value)} />
        </label>
      )}
      <label className="pm-wide">Mensaje
        <input maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ej. fueron 2 goles, no 3" />
      </label>
      {error && <p className="form-message" role="alert">{error}</p>}
      <div className="pm-actions">
        <button type="button" className="md-btn md-btn-ghost fx-btn-sm" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="submit" className="md-btn md-btn-accent fx-btn-sm" disabled={busy}>Enviar</button>
      </div>
    </form>
  );
}

export default function PostmatchPanel({ match, me, isAdmin, profileById, variant = "editorial", postmatchApi = defaultApi, onChanged }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [mode, setMode] = useState(null); // "self" | "admin" | "correction"
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const meId = me?.id;
  const nameOf = useCallback((id) => {
    const p = profileById?.get?.(id);
    return p ? displayName(p) : id === meId ? displayName(me) : "Jugador";
  }, [profileById, meId, me]);

  const load = useCallback(async () => {
    try { setSummary(await postmatchApi.postmatchSummary(match.id)); setUnavailable(false); }
    catch (e) {
      if (/function|does not exist|schema cache|404/i.test(e?.message || "")) setUnavailable(true);
      else setError(e?.message || "No se pudo cargar el postpartido.");
    }
  }, [postmatchApi, match.id]);
  useEffect(() => { load(); }, [load]);

  const participants = summary?.participants || [];
  const amIn = participants.includes(meId);
  const closed = Boolean(summary?.closed);
  const list = useMemo(() => rows(summary, meId), [summary, meId]);
  const toDecide = useMemo(() => decidable(summary, meId, isAdmin), [summary, meId, isAdmin]);
  const validator = summary?.validator || null;
  const [pick, setPick] = useState("");
  const mvp = mvpView(summary);
  const eventOf = (id, kind) => (summary?.events || []).find((e) => e.subject_id === id && e.kind === kind);
  const openCorrections = (summary?.corrections || []).filter((c) => c.status === "open");

  async function run(key, fn, ok) {
    setBusyId(key); setError(""); setNotice("");
    try { await fn(); await load(); onChanged?.(); if (ok) setNotice(ok); return null; }
    catch (e) { const msg = e?.message || "No se pudo guardar."; setError(msg); return msg; }
    finally { setBusyId(null); }
  }

  async function report(subject, values) {
    const adminForOther = isAdmin && subject !== meId;
    for (const { id: kind } of KINDS) {
      const q = values[kind] ?? 0;
      const e = eventOf(subject, kind);
      if (!e && q === 0) continue;
      if (e && e.quantity === q && (e.status === "confirmed" || !adminForOther)) continue;
      try { await postmatchApi.postmatchReport(match.id, subject, kind, q); }
      catch (e) { await load(); return e?.message || "No se pudo guardar."; }
    }
    await load(); onChanged?.(); setMode(null);
    setNotice(subject === meId || !isAdmin ? "Guardado como pendiente de validación." : "Datos confirmados.");
    return null;
  }

  if (unavailable) return null;
  if (!summary) return error ? <p className="fx-alert is-bad" role="alert">{error}</p> : null;

  return (
    <section className={`mdd-section pm-panel is-${variant}`} id="postpartido" aria-labelledby="pm-title" data-postmatch>
      <div className="mdd-head">
        <h2 id="pm-title"><ClipboardCheck size={18} aria-hidden="true" /> Postpartido</h2>
        <small>{closed ? "Cerrado" : "Abierto"} · {participants.length} jugadores en la alineación</small>
      </div>
      {summary.legacy_stats && <p className="fx-hint">Este partido ya tenía estadísticas cargadas antes: se conservan tal cual.</p>}
      {error && <p className="fx-alert is-bad" role="alert">{error}</p>}
      {notice && <p className="fx-alert is-good" role="status">{notice}</p>}

      <div className="pm-toolbar">
        {amIn && !closed && <button type="button" className="md-btn md-btn-accent fx-btn-sm" onClick={() => setMode(mode === "self" ? null : "self")}>Cargar mis datos</button>}
        {isAdmin && <button type="button" className="md-btn md-btn-ghost fx-btn-sm" onClick={() => setMode(mode === "admin" ? null : "admin")}>Cargar datos de un jugador</button>}
        {(amIn || isAdmin) && <button type="button" className="md-btn md-btn-ghost fx-btn-sm" onClick={() => setMode(mode === "correction" ? null : "correction")}><MessageSquareWarning size={14} aria-hidden="true" /> Pedir corrección</button>}
      </div>
      {mode === "self" && <ReportForm subjectId={meId} subjects={[meId]} nameOf={nameOf} current={eventOf} selfReport onSubmit={report} onCancel={() => setMode(null)} />}
      {mode === "admin" && <ReportForm subjects={participants} nameOf={nameOf} current={eventOf} selfReport={false} onSubmit={report} onCancel={() => setMode(null)} />}
      {mode === "correction" && (
        <CorrectionForm events={summary.events || []} nameOf={nameOf} onCancel={() => setMode(null)}
          onSubmit={(eventId, message, proposed) => run("corr", () => postmatchApi.postmatchRequestCorrection(match.id, eventId, message, proposed), "Corrección enviada a la administración.").then((err) => { if (!err) setMode(null); return err; })} />
      )}

      <ul className="pm-rows">
        {list.map(({ id, events }) => (
          <li key={id} className={id === meId ? "is-me" : ""}>
            <b>{nameOf(id)}{id === meId && <em> (vos)</em>}</b>
            <span className="pm-events">
              {events.filter((e) => e.quantity > 0 || e.status !== "confirmed").length === 0 && <small className="fx-hint">Sin datos</small>}
              {events.filter((e) => e.quantity > 0).map((e) => (
                <span key={e.id} className={`pm-ev is-${e.status}`} data-event={e.kind}>
                  {e.kind === "clean_sheet" ? "Valla invicta" : `${e.quantity} ${kindLabel(e.kind, e.quantity)}`}
                  <StatusChip tone={STATUS[e.status]?.tone}>{STATUS[e.status]?.label}</StatusChip>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>

      {(validator || needsValidator(summary, meId)) && (
        <div className={`pm-validator${needsValidator(summary, meId) ? " is-needed" : ""}`} aria-label="Validador del partido" data-validator={validator ? nameOf(validator.validator_id) : ""}>
          <h3><UserCheck size={16} aria-hidden="true" /> Validador del partido</h3>
          {validator ? (
            <>
              <p><b>{nameOf(validator.validator_id)}</b> valida los datos de {nameOf(validator.designated_by)} en este partido{validator.used ? " (ya revisó datos)" : ""}. Solo puede validar esos datos, nada más.</p>
              {summary.can_designate && !validator.used && (
                <button type="button" className="md-btn md-btn-ghost fx-btn-sm" disabled={busyId === "validator"}
                  onClick={() => run("validator", () => postmatchApi.postmatchRevokeValidator(match.id), "Validador revocado.")}>Revocar</button>
              )}
            </>
          ) : (
            <>
              <p>Sos el único admin y jugaste: tus datos no pueden quedar validados por vos. Elegí a un compañero de este partido para validarlos. Solo va a poder validar tus datos de este partido, y queda registrado en el historial.</p>
              <div className="pm-actions">
                <select aria-label="Elegí al validador" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Elegí un compañero…</option>
                  {participants.filter((id) => id !== meId).map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
                <button type="button" className="md-btn md-btn-accent fx-btn-sm" disabled={!pick || busyId === "validator"}
                  onClick={() => run("validator", () => postmatchApi.postmatchSetValidator(match.id, pick), "Validador designado.").then(() => setPick(""))}>Designar</button>
              </div>
            </>
          )}
        </div>
      )}

      {toDecide.length > 0 && (
        <div className="pm-decide" aria-label="Datos para validar">
          <h3>{isAdmin ? "Para validar" : `Datos de ${nameOf(validator?.designated_by)} para validar`}</h3>
          <ul>
            {toDecide.map((e) => (
              <li key={e.id}>
                <span>{nameOf(e.subject_id)} · {e.kind === "clean_sheet" ? "valla invicta" : `${e.quantity} ${kindLabel(e.kind, e.quantity)}`}</span>
                <span className="pm-actions">
                  <button type="button" className="md-btn md-btn-accent fx-btn-sm" disabled={busyId === e.id} aria-label={`Confirmar ${kindLabel(e.kind, e.quantity)} de ${nameOf(e.subject_id)}`}
                    onClick={() => run(e.id, () => postmatchApi.postmatchDecide(e.id, true), "Dato confirmado.")}><Check size={14} aria-hidden="true" /> Confirmar</button>
                  <button type="button" className="md-btn md-btn-ghost fx-btn-sm" disabled={busyId === e.id} aria-label={`Rechazar ${kindLabel(e.kind, e.quantity)} de ${nameOf(e.subject_id)}`}
                    onClick={() => run(e.id, () => postmatchApi.postmatchDecide(e.id, false), "Dato rechazado.")}><X size={14} aria-hidden="true" /> Rechazar</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isAdmin && !summary.can_designate && (summary.events || []).some((e) => e.status === "provisional" && e.subject_id === meId) && (
        <p className="fx-hint">Tus propios datos los tiene que validar otro admin.</p>
      )}

      {(openCorrections.length > 0) && (
        <div className="pm-decide" aria-label="Correcciones">
          <h3>Correcciones abiertas</h3>
          <ul>
            {openCorrections.map((c) => {
              const ev = (summary.events || []).find((e) => e.id === c.event_id);
              const own = ev && ev.subject_id === meId;
              return (
                <li key={c.id}>
                  <span>{nameOf(c.requested_by)}: “{c.message}”{ev ? ` · ${nameOf(ev.subject_id)} ${ev.quantity} → ${c.proposed_quantity ?? "?"} ${kindLabel(ev.kind)}` : ""}</span>
                  {canResolve(summary, c, meId, isAdmin) && (
                    <span className="pm-actions">
                      <button type="button" className="md-btn md-btn-accent fx-btn-sm" disabled={own || busyId === c.id} title={own ? "Cambia tus propios datos: la resuelve otro admin." : undefined}
                        onClick={() => run(c.id, () => postmatchApi.postmatchResolveCorrection(c.id, true, null), "Corrección aplicada.")}>Aceptar</button>
                      <button type="button" className="md-btn md-btn-ghost fx-btn-sm" disabled={busyId === c.id}
                        onClick={() => run(c.id, () => postmatchApi.postmatchResolveCorrection(c.id, false, null), "Corrección descartada.")}>Descartar</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="pm-mvp" aria-label="MVP">
        <h3><Crown size={16} aria-hidden="true" /> MVP</h3>
        {mvp.state === "official" && <p className="pm-mvp-win" data-mvp={nameOf(mvp.profileId)}><b>{nameOf(mvp.profileId)}</b> · MVP oficial con {mvp.votes} de {mvp.voters} votos</p>}
        {mvp.state === "none" && <p className="fx-hint">Sin MVP oficial: {mvp.reason === "participation" ? `votaron ${mvp.voters} de ${mvp.participants}, no alcanzó la participación mínima` : "hubo empate en la votación"}.</p>}
        {mvp.state === "open" && (
          <>
            <p className="fx-hint">Votaron {mvp.voters} de {mvp.participants}. Hace falta que voten al menos {mvp.quorum} y un solo ganador. El resultado se ve al cerrar.</p>
            {amIn && (
              <div className="pm-vote" role="group" aria-label="Votar MVP">
                {participants.filter((id) => id !== meId).map((id) => (
                  <button key={id} type="button" className={`md-btn fx-btn-sm ${summary.my_vote === id ? "md-btn-accent" : "md-btn-ghost"}`} aria-pressed={summary.my_vote === id}
                    disabled={busyId === "vote"} onClick={() => run("vote", () => postmatchApi.postmatchVoteMvp(match.id, id), "Voto registrado.")}>
                    {nameOf(id)}
                  </button>
                ))}
              </div>
            )}
            {isAdmin && (
              <button type="button" className="md-btn md-btn-ghost fx-btn-sm" disabled={busyId === "close"}
                onClick={() => run("close", () => postmatchApi.postmatchClose(match.id), "Postpartido cerrado.")}>Cerrar postpartido</button>
            )}
          </>
        )}
      </div>

      {(summary.history || []).length > 0 && (
        <details className="pm-history">
          <summary><History size={14} aria-hidden="true" /> Historial de cambios ({summary.history.length})</summary>
          <ol>
            {summary.history.map((h) => (
              <li key={h.id}><time>{new Date(h.created_at).toLocaleString("es-GT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time> {historyLine(h, nameOf)}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
