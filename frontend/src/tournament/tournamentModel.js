/*
 * F5 Premium — Entrega 4: tournament presentation model.
 * Read-only helpers over the rows produced by tournamentEngine.js / the API.
 * Fixtures generation and standings updates stay in tournamentEngine.js unchanged;
 * nothing here writes or recalculates points.
 */

export const FORMATS = [
  { id: "cuadrangular", label: "Cuadrangular", desc: "4 equipos, todos contra todos + final" },
  { id: "league", label: "Liga", desc: "Todos contra todos, campeón por puntos" },
  { id: "league_playoffs", label: "Liga + Playoffs", desc: "Liga regular + semifinales y final" },
  { id: "playoffs_only", label: "Solo Playoffs", desc: "Eliminación directa (2, 4 u 8 equipos)" },
];

export const DAYS = [
  { id: "monday", label: "Lunes" }, { id: "tuesday", label: "Martes" },
  { id: "wednesday", label: "Miércoles" }, { id: "thursday", label: "Jueves" },
  { id: "friday", label: "Viernes" }, { id: "saturday", label: "Sábado" },
  { id: "sunday", label: "Domingo" },
];

export const TEAM_COLORS = ["#22c55e", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export const formatLabel = (id) => FORMATS.find((f) => f.id === id)?.label || id;
export const tournamentStatusLabel = (s) => (s === "draft" ? "Borrador" : s === "active" ? "Activo" : "Finalizado");
export const teamColor = (index) => TEAM_COLORS[index % TEAM_COLORS.length];

/** Same rating sum as before: missing ratings count as 2. */
export function teamRating(memberIds, ratingMap) {
  return memberIds.reduce((sum, pid) => sum + (ratingMap.get(pid)?.rating || 2), 0);
}

export const isPlayoffMatch = (m) => Boolean(m.is_playoff || m.is_final || m.playoff_label);

/** Matches grouped by round, ascending (same grouping the fixtures view used). */
export function groupRounds(matches = []) {
  const map = new Map();
  matches.forEach((m) => { if (!map.has(m.round)) map.set(m.round, []); map.get(m.round).push(m); });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([round, list]) => ({
    round,
    matches: [...list].sort((a, b) => (a.match_order || 0) - (b.match_order || 0)),
    playoff: list.some(isPlayoffMatch),
    played: list.filter((m) => m.status === "played").length,
    date: list.find((m) => m.match_date)?.match_date || null,
  }));
}

export function roundTitle(group, totalPlayoffRounds, playoffIndex) {
  if (!group.playoff) return `Jornada ${group.round}`;
  const label = group.matches[0]?.playoff_label;
  if (group.matches.length === 1 && (label === "Final" || group.matches[0]?.is_final || playoffIndex === totalPlayoffRounds - 1)) return "Final";
  if (label && /semifinal/i.test(label)) return "Semifinales";
  if (group.matches.length === 2) return "Semifinales";
  if (group.matches.length === 4) return "Cuartos de final";
  return label || `Ronda ${playoffIndex + 1}`;
}

/** Winner id of a played match (null on draw or not played). */
export function matchWinner(m) {
  if (m.status !== "played" || m.home_score == null || m.away_score == null) return null;
  if (m.home_score > m.away_score) return m.home_team_id;
  if (m.away_score > m.home_score) return m.away_team_id;
  return null;
}

/** Bracket columns: playoff rounds left → right. Empty when the format has no playoffs. */
export function bracketColumns(matches = []) {
  const rounds = groupRounds(matches.filter(isPlayoffMatch));
  return rounds.map((g, i) => ({ ...g, title: roundTitle(g, rounds.length, i) }));
}

/** Last N results per team (W/D/L), most recent last. Display only. */
export function formGuide(matches = [], teamId, n = 5) {
  return matches
    .filter((m) => m.status === "played" && (m.home_team_id === teamId || m.away_team_id === teamId))
    .sort((a, b) => (a.round - b.round) || ((a.match_order || 0) - (b.match_order || 0)))
    .slice(-n)
    .map((m) => {
      const w = matchWinner(m);
      return w == null ? "E" : w === teamId ? "G" : "P";
    });
}

export function tournamentProgress(matches = []) {
  const played = matches.filter((m) => m.status === "played");
  return {
    total: matches.length,
    played: played.length,
    goals: played.reduce((s, m) => s + Number(m.home_score || 0) + Number(m.away_score || 0), 0),
    next: matches.filter((m) => m.status !== "played").sort((a, b) => (a.round - b.round) || ((a.match_order || 0) - (b.match_order || 0)))[0] || null,
  };
}
