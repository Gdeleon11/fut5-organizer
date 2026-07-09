import React, { useState, useEffect } from "react";
import { calculateFifaStats } from "./FifaCard.jsx";
import { getCapacities, capsToStats } from "../capacityStore.js";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

// Mapea el overall (atributos configurados) a un rango de temporada
function seasonRank(overall) {
  if (overall >= 88) return { label: "Diamante", key: "diamond", tag: "D" };
  if (overall >= 78) return { label: "Platino", key: "platinum", tag: "P" };
  if (overall >= 68) return { label: "Oro", key: "gold", tag: "O" };
  if (overall >= 55) return { label: "Plata", key: "silver", tag: "S" };
  return { label: "Bronce", key: "bronze", tag: "B" };
}

/**
 * Panel "Distribución de Habilidades".
 * La gráfica se calcula SOLO con los atributos configurados del jugador
 * (rating de ataque/medio/defensa + posición + habilidades especiales),
 * NO con el historial de goles/asistencias. Por eso se llama a
 * calculateFifaStats sin pasar matchStats.
 */
export default function SkillDistribution({
  profile,
  ratingObj,
  playerSkills = [],
  isGuest = false,
  guestRating = 3,
  matchStats = [],
}) {
  // Re-render cuando cambian las capacidades manuales (evento del store).
  const [capsVersion, setCapsVersion] = useState(0);
  useEffect(() => {
    const handler = () => setCapsVersion((v) => v + 1);
    window.addEventListener("f5-capacities-changed", handler);
    return () => window.removeEventListener("f5-capacities-changed", handler);
  }, []);

  // Atributos: capacidades manuales (1-100) si existen; si no, calculados desde estrellas.
  // eslint-disable-next-line no-unused-vars
  const _v = capsVersion;
  const manualCaps = capsToStats(getCapacities(profile?.id));
  const stats = calculateFifaStats(
    profile,
    ratingObj,
    playerSkills,
    isGuest,
    guestRating,
    [],
    manualCaps,
  );

  const rank = seasonRank(stats.overall);

  // Datos del radar en orden horario: RITMO → TIRO → REGATE → FÍSICO → DEFENSA → PASE
  const chartData = [
    { subject: "RITMO", A: stats.pac },
    { subject: "TIRO", A: stats.sho },
    { subject: "REGATE", A: stats.dri },
    { subject: "FÍSICO", A: stats.phy },
    { subject: "DEFENSA", A: stats.def },
    { subject: "PASE", A: stats.pas },
  ];

  // Historial (solo para las tarjetas de conteo, no para la gráfica)
  const playerId = profile?.id;
  const playerStatsList = (matchStats || []).filter((s) =>
    s && (isGuest ? s.guest_player_id === playerId : s.player_id === playerId),
  );
  const totalMatches = playerStatsList.length;
  const totalGoals = playerStatsList.reduce((sum, s) => sum + (s.goals || 0), 0);

  return (
    <div className="skill-distribution">
      <div className="skill-distribution-head">
        <span className="skill-distribution-icon" aria-hidden="true">
          {/* icono barras */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="20" x2="6" y2="12" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="18" y1="20" x2="18" y2="9" />
          </svg>
        </span>
        <h3>Distribución de Habilidades</h3>
      </div>

      <div className="skill-radar-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>
            <PolarGrid gridType="polygon" stroke="var(--accent)" strokeOpacity={0.18} />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "var(--text-secondary)", fontSize: 10, fontWeight: 600 }}
            />
            <Radar
              name="Habilidad"
              dataKey="A"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="var(--accent)"
              fillOpacity={0.28}
              domain={[0, 99]}
              isAnimationActive={true}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="skill-stat-grid">
        <div className="skill-stat-card">
          <span className="skill-stat-label">Rango de temporada</span>
          <span className={`skill-stat-value skill-rank ${rank.key}`}>
            {rank.label}
            <span className="skill-rank-badge">{rank.tag}</span>
          </span>
        </div>
        <div className="skill-stat-card">
          <span className="skill-stat-label">Habilidad general</span>
          <span className="skill-stat-value is-accent">{stats.overall}</span>
        </div>
        <div className="skill-stat-card">
          <span className="skill-stat-label">Partidos</span>
          <span className="skill-stat-value">{totalMatches}</span>
        </div>
        <div className="skill-stat-card">
          <span className="skill-stat-label">Goles</span>
          <span className="skill-stat-value">{totalGoals}</span>
        </div>
      </div>
    </div>
  );
}
