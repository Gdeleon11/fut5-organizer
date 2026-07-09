import { useState, useEffect } from "react";
import { api } from "../api.js";

export default function SelfStatsCard({ match, profile, matchStats, activeGroupId, onNotice }) {
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [cleanSheet, setCleanSheet] = useState(false);
  const [mvp, setMvp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (!match || !profile) return;
    const existing = (matchStats || []).find(
      (s) => s.match_id === match.id && s.player_id === profile.id
    );
    if (existing) {
      setGoals(existing.goals || 0);
      setAssists(existing.assists || 0);
      setCleanSheet(existing.clean_sheet || false);
      setMvp(existing.mvp || false);
      setHasSaved(true);
    }
  }, [match, profile, matchStats]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!match?.id || !profile?.id || !activeGroupId) return;
    
    setSaving(true);
    try {
      await api.saveSinglePlayerMatchStats(match.id, activeGroupId, profile.id, {
        goals,
        assists,
        clean_sheet: cleanSheet,
        mvp,
      }, profile.id);
      setHasSaved(true);
      if (onNotice) onNotice("¡Estadísticas guardadas con éxito! 🏆");
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel" style={{ background: "linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)", borderLeft: "4px solid var(--accent)", marginBottom: "1.5rem" }}>
      <div className="section-heading" style={{ marginBottom: "1rem" }}>
        <div>
          <p className="eyebrow" style={{ color: "var(--accent)" }}>TU RENDIMIENTO</p>
          <h3 style={{ margin: 0 }}>¡Sube tus estadísticas!</h3>
        </div>
        {hasSaved && <span className="count-pill">Guardado ✅</span>}
      </div>
      
      <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1rem" }}>
        Registra tu rendimiento en este partido. Ayuda a mantener el ranking global actualizado.
      </p>

      <form onSubmit={handleSave} className="grid" style={{ gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
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
          <label className="checkbox-label" style={{ padding: "0.5rem", background: "var(--surface-0)", borderRadius: "var(--radius)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input 
              type="checkbox" 
              checked={cleanSheet} 
              onChange={(e) => setCleanSheet(e.target.checked)} 
            />
            🛡️ Valla Invicta (Porteros o defensas)
          </label>
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="checkbox-label" style={{ padding: "0.5rem", background: "var(--surface-0)", borderRadius: "var(--radius)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input 
              type="checkbox" 
              checked={mvp} 
              onChange={(e) => setMvp(e.target.checked)} 
            />
            ⭐ Fui elegido MVP del partido
          </label>
        </div>

        <div className="field" style={{ gridColumn: "1 / -1", marginTop: "0.5rem" }}>
          <button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar mis estadísticas"}
          </button>
        </div>
      </form>
    </div>
  );
}
