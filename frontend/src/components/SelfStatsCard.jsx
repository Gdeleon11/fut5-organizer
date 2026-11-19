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
    <section className="self-performance">
      <header className="section-heading">
        <div><p className="eyebrow">Rendimiento individual</p><h3>Mi partido</h3></div>
        {hasSaved && <span className="count-pill">Guardado</span>}
      </header>
      <form onSubmit={handleSave}>
        <div className="performance-inputs">
          <label>Goles<input type="number" min="0" value={goals} onChange={e => setGoals(parseInt(e.target.value) || 0)} /></label>
          <label>Asistencias<input type="number" min="0" value={assists} onChange={e => setAssists(parseInt(e.target.value) || 0)} /></label>
        </div>
        <div className="md-survey-checks">
          <label className={`mdd-toggle${cleanSheet ? " is-on" : ""}`}><input type="checkbox" checked={cleanSheet} onChange={e => setCleanSheet(e.target.checked)} /> Valla invicta</label>
          <label className={`mdd-toggle${mvp ? " is-on" : ""}`}><input type="checkbox" checked={mvp} onChange={e => setMvp(e.target.checked)} /> MVP del partido</label>
        </div>
        <button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar mis estadísticas"}</button>
      </form>
    </section>
  );
}
