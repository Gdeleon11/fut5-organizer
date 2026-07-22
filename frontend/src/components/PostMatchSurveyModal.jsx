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
        maxWidth: "460px",
        background: "var(--surface-1)",
        position: "relative",
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: 0
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

        <div style={{ padding: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <p className="eyebrow" style={{ color: "var(--primary)", margin: "0 0 0.5rem 0" }}>ENCUESTA POST-PARTIDO</p>
          <h2 style={{ margin: "0 0 0.25rem 0", fontSize: "1.2rem", fontWeight: "600" }}>{match.title || "Partido"}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0 }}>
            {step === 1 ? "Registra tu desempeño para el ranking global." : "Califica a tus compañeros de partido."}
          </p>
        </div>

        <div style={{ padding: "1.5rem", overflowY: "auto", flexGrow: 1 }}>
          {step === 1 && (
            <form onSubmit={handleSaveStats} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" }}>⚽ Goles</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={goals} 
                    onChange={(e) => setGoals(parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                      fontSize: "1.5rem",
                      padding: "0.25rem 0",
                      textAlign: "center"
                    }}
                  />
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" }}>👟 Asistencias</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={assists} 
                    onChange={(e) => setAssists(parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                      fontSize: "1.5rem",
                      padding: "0.25rem 0",
                      textAlign: "center"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={cleanSheet} 
                    onChange={(e) => setCleanSheet(e.target.checked)}
                    style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--primary)" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>🛡️ Mantuve la valla invicta</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={mvp} 
                    onChange={(e) => setMvp(e.target.checked)}
                    style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--primary)" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>⭐ Fui elegido MVP del partido</span>
                </label>
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                <button type="submit" disabled={saving} style={{ width: "100%" }}>
                  {saving ? "Guardando..." : "Siguiente →"}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
                      padding: "0.5rem 0",
                      borderBottom: "1px solid rgba(255,255,255,0.03)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <Avatar profile={p} size={32} />
                        <div>
                          <span style={{ fontWeight: "500", fontSize: "0.9rem", display: "block" }}>{displayName(p)}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>{p.preferred_position || "Jugador"}</span>
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
              
              <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
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
