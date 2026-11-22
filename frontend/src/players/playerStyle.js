/* Player Builder — self-declared style + verified record + achievements. Pure helpers.
 * Style points are what the player SAYS about themselves; they never change the official rating,
 * history or awards. Verified numbers and achievements come only from official data. */

export const STYLE_POINTS = 10;
export const STYLE_KEYS = [
  { key: "attack", label: "Ataque", hint: "Definición y llegada al gol" },
  { key: "defense", label: "Defensa", hint: "Marca, quite y orden atrás" },
  { key: "passing", label: "Pase / visión", hint: "Asistencias y juego en equipo" },
  { key: "pace", label: "Ritmo / resistencia", hint: "Velocidad y aguante" },
  { key: "goalkeeping", label: "Portería", hint: "Atajar y salir jugando" },
];
export const POSITIONS = [
  { id: "Goalkeeper", label: "Portero", short: "POR" },
  { id: "Defender", label: "Defensa", short: "DEF" },
  { id: "Midfielder", label: "Medio", short: "MED" },
  { id: "Forward", label: "Delantero", short: "DEL" },
  { id: "Flexible", label: "Flexible", short: "FLX" },
];
export const positionLabel = (id) => POSITIONS.find((p) => p.id === id)?.label || "Flexible";

const STARTER = {
  Goalkeeper: { attack: 0, defense: 2, passing: 2, pace: 1, goalkeeping: 5 },
  Defender: { attack: 1, defense: 4, passing: 2, pace: 3, goalkeeping: 0 },
  Midfielder: { attack: 2, defense: 2, passing: 4, pace: 2, goalkeeping: 0 },
  Forward: { attack: 5, defense: 1, passing: 2, pace: 2, goalkeeping: 0 },
  Flexible: { attack: 2, defense: 2, passing: 2, pace: 2, goalkeeping: 2 },
};

/** A suggested starting split for a position (the player can change every point). */
export function starterStyle(position) {
  return { ...(STARTER[position] || STARTER.Flexible) };
}

export const usedPoints = (s = {}) => STYLE_KEYS.reduce((t, { key }) => t + (Number(s[key]) || 0), 0);

export function validateStyle(style, primary) {
  for (const { key, label } of STYLE_KEYS) {
    const v = Number(style?.[key]);
    if (!Number.isInteger(v) || v < 0 || v > STYLE_POINTS) return `${label}: usá un número entero entre 0 y ${STYLE_POINTS}.`;
  }
  const used = usedPoints(style);
  if (used !== STYLE_POINTS) return used < STYLE_POINTS ? `Te faltan repartir ${STYLE_POINTS - used} puntos.` : `Te pasaste por ${used - STYLE_POINTS} puntos.`;
  if (style.secondary_position && primary && style.secondary_position === primary && primary !== "Flexible") {
    return "La posición secundaria tiene que ser distinta de la principal.";
  }
  return null;
}

/** Adds/removes one point, keeping the total at most 10. */
export function adjustPoint(style, key, delta) {
  const next = { ...style };
  const v = (Number(next[key]) || 0) + delta;
  if (v < 0 || v > STYLE_POINTS) return style;
  if (delta > 0 && usedPoints(style) >= STYLE_POINTS) return style;
  next[key] = v;
  return next;
}

const isPast = (m, now) => m && (m.status === "closed" || new Date(`${m.match_date}T${(m.start_time || "23:59").slice(0, 5)}:00-06:00`) <= now);

/** Verified record: only official data (attendance at played matches, official stats, official MVPs, admin rating). */
export function verifiedRecord({ profileId, matches = [], attendances = [], stats = [], closures = [], rating = null, now = new Date() }) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const played = new Set(attendances
    .filter((a) => a.profile_id === profileId && ["confirmed", "checked_in"].includes(a.status) && isPast(byId.get(a.match_id), now) && byId.get(a.match_id)?.status !== "canceled")
    .map((a) => a.match_id));
  const mine = stats.filter((s) => s.player_id === profileId);
  const mvpMatches = new Set([
    ...mine.filter((s) => s.mvp).map((s) => s.match_id),
    ...closures.filter((c) => c.mvp_profile_id === profileId).map((c) => c.match_id),
  ]);
  return {
    played: played.size,
    goals: mine.reduce((t, s) => t + (Number(s.goals) || 0), 0),
    assists: mine.reduce((t, s) => t + (Number(s.assists) || 0), 0),
    cleanSheets: mine.filter((s) => s.clean_sheet).length,
    mvps: mvpMatches.size,
    officialRating: rating?.rating ?? null,
  };
}

const ACHIEVEMENTS = [
  { id: "debut", label: "Debut", desc: "Jugó su primer partido", test: (r) => r.played >= 1 },
  { id: "regular", label: "Habitual", desc: "10 partidos jugados", test: (r) => r.played >= 10 },
  { id: "veteran", label: "Veterano", desc: "25 partidos jugados", test: (r) => r.played >= 25 },
  { id: "first-goal", label: "Primer gol", desc: "Marcó su primer gol confirmado", test: (r) => r.goals >= 1 },
  { id: "scorer", label: "Goleador", desc: "10 goles confirmados", test: (r) => r.goals >= 10 },
  { id: "assister", label: "Asistidor", desc: "5 asistencias confirmadas", test: (r) => r.assists >= 5 },
  { id: "wall", label: "Valla invicta", desc: "Terminó un partido sin goles en contra", test: (r) => r.cleanSheets >= 1 },
  { id: "mvp", label: "MVP", desc: "Elegido MVP oficial por sus compañeros", test: (r) => r.mvps >= 1 },
];

/** Achievements earned from the verified record only (nothing invented to fill the card). */
export function achievements(record) {
  return ACHIEVEMENTS.filter((a) => a.test(record)).map(({ id, label, desc }) => ({ id, label, desc }));
}
