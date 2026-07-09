import { useState, useMemo, useEffect } from "react";
import { Star, X } from "lucide-react";
import { api } from "../api.js";
import Avatar from "./Avatar.jsx";
import { displayName } from "../utils.js";

// A simpler inline StarRating for the modal
function ModalStarRating({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "0.25rem" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          style={{
            background: "none",
            border: "none",
            padding: "0.2rem",
            cursor: "pointer",
            color: star <= value ? "#f59e0b" : "var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Star size={18} fill={star <= value ? "#f59e0b" : "transparent"} />
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
      await api.saveSinglePlayerMatchStats(match.id, activeGroupId, profile.id, {
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

  // Overlay to block interactions outside
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem"
    }}>
      <div className="panel" style={{
        width: "100%",
        maxWidth: "500px",
        background: "var(--surface-1)",
        position: "relative",
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            zIndex: 10
          }}
        >
          <X size={20} />
        </button>

        <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <p className="eyebrow" style={{ color: "var(--accent)" }}>ENCUESTA POST-PARTIDO</p>
          <h2 style={{ margin: "0.25rem 0 0.5rem 0" }}>{match.title || "Partido"}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0 }}>
            {step === 1 ? "Sube tus estadísticas del partido." : "Califica el desempeño de tus compañeros."}
          </p>
        </div>

        <div style={{ padding: "1.5rem", overflowY: "auto", flexGrow: 1 }}>
          {step === 1 && (
            <form onSubmit={handleSaveStats} className="grid" style={{ gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
              <div className="field">
                <label>⚽ Goles</label>
                <input 
                  type="number" 
                  min="0" 
                  value={goals} 
                  onChange={(e) => setGoals(parseInt(e.target.value) || 0)} 
                />
              </div>
              
              <div className="field">
                <label>👟 Asistencias</label>
                <input 
                  type="number" 
                  min="0" 
                  value={assists} 
                  onChange={(e) => setAssists(parseInt(e.target.value) || 0)} 
                />
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="checkbox-label" style={{ padding: "0.75rem", background: "var(--surface-0)", borderRadius: "var(--radius)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <input 
                    type="checkbox" 
                    checked={cleanSheet} 
                    onChange={(e) => setCleanSheet(e.target.checked)} 
                  />
                  🛡️ Valla Invicta (Porteros o defensas)
                </label>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="checkbox-label" style={{ padding: "0.75rem", background: "var(--surface-0)", borderRadius: "var(--radius)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <input 
                    type="checkbox" 
                    checked={mvp} 
                    onChange={(e) => setMvp(e.target.checked)} 
                  />
                  ⭐ Fui elegido MVP del partido
                </label>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
                <button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar mis estadísticas y Continuar"}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {teammates.length === 0 ? (
                <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "1rem 0" }}>No hay otros jugadores registrados en este partido.</p>
              ) : (
                teammates.map(p => {
                  const currentVote = userVoteMap?.get(p.id) || 0;
                  return (
                    <div key={p.id} style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      padding: "0.75rem",
                      background: "var(--surface-0)",
                      borderRadius: "var(--radius)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <Avatar profile={p} size={36} />
                        <div>
                          <span style={{ fontWeight: "600", fontSize: "0.9rem", display: "block" }}>{displayName(p)}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{p.preferred_position}</span>
                        </div>
                      </div>
                      <ModalStarRating 
                        value={currentVote} 
                        onChange={(val) => onVote && onVote(p.id, val)}
                      />
                    </div>
                  );
                })
              )}
              
              <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
                <button className="ghost-button" onClick={() => setStep(1)} style={{ flex: 1 }}>Atrás</button>
                <button onClick={handleFinish} style={{ flex: 2 }}>Finalizar Encuesta</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
