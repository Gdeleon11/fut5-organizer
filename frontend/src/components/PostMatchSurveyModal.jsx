import { useState, useMemo, useEffect } from "react";
import { Crown, Minus, Plus, Shield, Star, X } from "lucide-react";
import { api } from "../api.js";
import Avatar from "./Avatar.jsx";
import { displayName } from "../utils.js";

// A simpler inline StarRating for the modal
function ModalStarRating({ value, onChange, label }) {
  return (
    <div className="md-stars" role="group" aria-label={label || "Calificación"}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? "is-on" : ""}
          aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"}`}
          aria-pressed={star <= value}
          onClick={() => onChange(star)}
        >
          <Star size={18} fill={star <= value ? "currentColor" : "transparent"} />
        </button>
      ))}
    </div>
  );
}

export default function PostMatchSurveyModal({
  match,
  profile,
  activeGroupId,
  attendances,
  profiles,
  onClose,
  onSaveStats,
  onNotice,
  onVote,
  userVoteMap
}) {
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [cleanSheet, setCleanSheet] = useState(false);
  const [mvp, setMvp] = useState(false);
  const [saving, setSaving] = useState(false);

  // Attendees (excluding current user)
  const teammates = useMemo(() => {
    if (!match || !attendances || !profiles) return [];
    const attendingIds = attendances
      .filter(a => a.match_id === match.id && ["confirmed", "checked_in"].includes(a.status))
      .map(a => a.profile_id);
    return profiles.filter(p => attendingIds.includes(p.id) && p.id !== profile.id);
  }, [match, attendances, profiles, profile]);

  const handleSaveStats = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveSinglePlayerMatchStats(match.id, match.group_id || activeGroupId, profile.id, {
        goals,
        assists,
        clean_sheet: cleanSheet,
        mvp,
      }, profile.id);
      
      if (onSaveStats) onSaveStats(); // Reload stats globally
      
      // If there are teammates to vote on, go to step 2. Otherwise close.
      if (teammates.length > 0) {
        setStep(2);
      } else {
        if (onNotice) onNotice("¡Estadísticas guardadas con éxito!");
        onClose();
      }
    } catch (err) {
      alert("Error al guardar estadísticas: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    if (onNotice) onNotice("¡Gracias por completar la encuesta!");
    onClose();
  };

  const stepper = (label, value, setValue) => (
    <span className="mdd-stepper" role="group" aria-label={label}>
      <small>{label}</small>
      <button type="button" aria-label={`Restar ${label}`} onClick={() => setValue(Math.max(0, value - 1))} disabled={value <= 0}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <b>{value}</b>
      <button type="button" aria-label={`Sumar ${label}`} onClick={() => setValue(value + 1)}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </span>
  );

  // Overlay blocks interactions outside (same behaviour as before)
  return (
    <div className="md-modal-overlay md-survey">
      <div className="md-modal" role="dialog" aria-modal="true" aria-labelledby="md-survey-title" style={{ position: "relative" }}>
        <header className="md-modal-head">
          <div>
            <p className="eyebrow">Encuesta post-partido · Paso {step} de 2</p>
            <h2 id="md-survey-title">{match.title || "Partido"}</h2>
            <small>{step === 1 ? "Registra tu desempeño para el ranking global." : "Califica a tus compañeros de partido."}</small>
          </div>
          <button type="button" className="md-icon-btn" aria-label="Cerrar encuesta" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="md-modal-body">
          {step === 1 && (
            <form id="md-survey-form" onSubmit={handleSaveStats}>
              <div className="md-survey-stats">
                {stepper("Goles", goals, setGoals)}
                {stepper("Asistencias", assists, setAssists)}
              </div>
              <div className="md-survey-checks">
                <label className={`mdd-toggle${cleanSheet ? " is-on" : ""}`}>
                  <input type="checkbox" checked={cleanSheet} onChange={(e) => setCleanSheet(e.target.checked)} />
                  <Shield size={14} aria-hidden="true" /> Mantuve la valla invicta
                </label>
                <label className={`mdd-toggle${mvp ? " is-on" : ""}`}>
                  <input type="checkbox" checked={mvp} onChange={(e) => setMvp(e.target.checked)} />
                  <Crown size={14} aria-hidden="true" /> Fui el MVP del partido
                </label>
              </div>
            </form>
          )}

          {step === 2 && (
            <div>
              {teammates.length === 0 ? (
                <p className="mdd-empty">No hay otros jugadores registrados en este partido.</p>
              ) : (
                teammates.map((p) => {
                  const currentVote = userVoteMap?.get(p.id) || 0;
                  return (
                    <div key={p.id} className="md-survey-row">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                        <Avatar profile={p} size="sm" />
                        <span>
                          {displayName(p)}
                          <small>{p.preferred_position || "Jugador"}</small>
                        </span>
                      </div>
                      <ModalStarRating value={currentVote} label={`Calificación para ${displayName(p)}`} onChange={(val) => onVote && onVote(p.id, val)} />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <footer className="md-modal-foot">
          {step === 1 ? (
            <button type="submit" form="md-survey-form" className="md-btn md-btn-accent" disabled={saving}>
              {saving ? "Guardando…" : "Siguiente"}
            </button>
          ) : (
            <>
              <button type="button" className="md-btn md-btn-ghost" onClick={() => setStep(1)}>Atrás</button>
              <button type="button" className="md-btn md-btn-accent" onClick={handleFinish}>Finalizar encuesta</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
