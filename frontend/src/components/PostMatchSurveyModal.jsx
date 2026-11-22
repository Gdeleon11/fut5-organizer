import { useEffect, useState } from "react";
import { Crown, Minus, Plus, X } from "lucide-react";
import { api as defaultApi } from "../api.js";
import { displayName } from "../utils.js";

/**
 * Short, optional post-match survey (2 steps, phone-first):
 *   1. Your goals / assists / clean sheet → saved as PROVISIONAL (an admin who is not you validates it).
 *   2. MVP vote among the real lineup (never yourself).
 * Nothing here writes official stats directly.
 */
export default function PostMatchSurveyModal({ match, profile, profiles = [], onClose, onDone, onNotice, postmatchApi = defaultApi }) {
  const [summary, setSummary] = useState(null);
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [clean, setClean] = useState(false);
  const [vote, setVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const me = profile?.id;
  const nameOf = (id) => { const p = profiles.find((x) => x.id === id); return p ? displayName(p) : "Jugador"; };

  useEffect(() => {
    let alive = true;
    postmatchApi.postmatchSummary(match.id).then((s) => {
      if (!alive) return;
      if (!s?.participants?.includes(me) || s.closed) { onClose(); return; }
      setSummary(s);
      const q = (k) => s.events?.find((e) => e.subject_id === me && e.kind === k)?.quantity ?? 0;
      setGoals(q("goal")); setAssists(q("assist")); setClean(q("clean_sheet") > 0); setVote(s.my_vote || null);
    }).catch(() => alive && onClose());
    return () => { alive = false; };
  }, [match.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!summary) return null;
  const mine = (k) => summary.events?.find((e) => e.subject_id === me && e.kind === k);
  const confirmedMine = ["goal", "assist", "clean_sheet"].some((k) => mine(k)?.status === "confirmed");

  async function saveMine() {
    setBusy(true); setError("");
    try {
      for (const [kind, q] of [["goal", goals], ["assist", assists], ["clean_sheet", clean ? 1 : 0]]) {
        const e = mine(kind);
        if ((!e && q === 0) || (e && e.quantity === q)) continue;
        await postmatchApi.postmatchReport(match.id, me, kind, q);
      }
      setStep(2);
    } catch (err) { setError(err?.message || "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  async function finish(withVote) {
    setBusy(true); setError("");
    try {
      if (withVote && vote && vote !== summary.my_vote) await postmatchApi.postmatchVoteMvp(match.id, vote);
      onNotice?.("¡Gracias! Tus datos quedan pendientes de validación.");
      onDone?.();
      onClose();
    } catch (err) { setError(err?.message || "No se pudo votar."); setBusy(false); }
  }

  const stepper = (label, value, set) => (
    <span className="mdd-stepper" role="group" aria-label={label}>
      <small>{label}</small>
      <button type="button" aria-label={`Restar ${label}`} onClick={() => set(Math.max(0, value - 1))} disabled={value <= 0 || confirmedMine}><Minus size={16} aria-hidden="true" /></button>
      <b>{value}</b>
      <button type="button" aria-label={`Sumar ${label}`} onClick={() => set(Math.min(20, value + 1))} disabled={confirmedMine}><Plus size={16} aria-hidden="true" /></button>
    </span>
  );

  return (
    <div className="md-modal-overlay md-survey">
      <div className="md-modal" role="dialog" aria-modal="true" aria-labelledby="md-survey-title">
        <header className="md-modal-head">
          <div>
            <p className="eyebrow">Postpartido · Paso {step} de 2 · opcional</p>
            <h2 id="md-survey-title">{match.title || "Partido"}</h2>
            <small>{step === 1 ? "¿Cómo te fue? Lo valida un admin." : "¿Quién fue el mejor? Tu voto es secreto hasta el cierre."}</small>
          </div>
          <button type="button" className="md-icon-btn" aria-label="Cerrar encuesta" onClick={onClose}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="md-modal-body">
          {error && <p className="form-message" role="alert">{error}</p>}
          {step === 1 && (
            <>
              {confirmedMine && <p className="fx-hint">Tus datos ya fueron confirmados. Si algo está mal, pedí una corrección en el partido.</p>}
              <div className="md-survey-stats">
                {stepper("Goles", goals, setGoals)}
                {stepper("Asistencias", assists, setAssists)}
              </div>
              <label className="pm-check"><input type="checkbox" checked={clean} disabled={confirmedMine} onChange={(e) => setClean(e.target.checked)} /> Valla invicta (no nos hicieron goles)</label>
              <div className="md-modal-actions">
                <button type="button" className="md-btn md-btn-ghost" onClick={() => setStep(2)} disabled={busy}>Saltar</button>
                <button type="button" className="md-btn md-btn-accent" onClick={confirmedMine ? () => setStep(2) : saveMine} disabled={busy}>{busy ? "Guardando…" : "Siguiente"}</button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="pm-vote is-survey" role="radiogroup" aria-label="Elegí al MVP">
                {summary.participants.filter((id) => id !== me).map((id) => (
                  <button key={id} type="button" role="radio" aria-checked={vote === id} className={`md-btn ${vote === id ? "md-btn-accent" : "md-btn-ghost"}`} onClick={() => setVote(id)}>
                    {vote === id && <Crown size={14} aria-hidden="true" />} {nameOf(id)}
                  </button>
                ))}
              </div>
              <div className="md-modal-actions">
                <button type="button" className="md-btn md-btn-ghost" onClick={() => finish(false)} disabled={busy}>Prefiero no votar</button>
                <button type="button" className="md-btn md-btn-accent" onClick={() => finish(true)} disabled={busy || !vote}>{busy ? "Enviando…" : "Votar y terminar"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
