/*
 * Balanced teams — player strength with evidence weighting, plus a plain-language explanation.
 *
 * strength (1–5) = (1 − w) · prior + w · performance,   w = n / (n + K)
 *   prior        = official rating set by an admin (player_ratings) if any; otherwise the group
 *                  average, so a new player is neither penalised nor boosted.
 *   performance  = prior adjusted by the player's CONFIRMED contribution per match
 *                  (goals, assists, official MVPs, clean sheets) against the group average.
 *   n            = matches with an official stats row; K = 5 (after 5 matches results weigh 50%).
 * Self-declared style (player_styles) never changes strength — the 10 points always add up to 10,
 * so they describe a role, not a level. It is used for positions and goalkeepers.
 */
import { normalizeRating } from "../teamGeneration.js";

export const EVIDENCE_K = 5;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;

function contribution(rows) {
  if (!rows.length) return 0;
  const total = rows.reduce((t, s) => t + (Number(s.goals) || 0) + 0.7 * (Number(s.assists) || 0) + (s.mvp ? 1.5 : 0) + (s.clean_sheet ? 0.5 : 0), 0);
  return total / rows.length;
}

/** Role from position + self-declared style. */
export function playerRole(player, style) {
  const primary = player.preferred_position || "Flexible";
  const secondary = style?.secondary_position || null;
  const gk = primary === "Goalkeeper" || secondary === "Goalkeeper" || (style?.goalkeeping ?? 0) >= 4 || (player.skills || []).includes("goalkeeper");
  let line = primary;
  if (line === "Flexible" && style) {
    const { attack = 0, defense = 0, passing = 0 } = style;
    line = attack >= defense && attack >= passing ? "Forward" : defense >= passing ? "Defender" : "Midfielder";
  }
  return { primary, secondary, line: line === "Goalkeeper" ? "Goalkeeper" : line, gk };
}

/**
 * Adds strength + provenance to each player. `stats` are official match_player_stats rows of the
 * group; `ratingMap` is profile_id → latest official rating row; `styles` is profile_id → style.
 */
export function enrichPlayers(players, { ratingMap = new Map(), stats = [], styles = new Map() } = {}) {
  const byPlayer = new Map();
  for (const s of stats) if (s?.player_id) (byPlayer.get(s.player_id) || byPlayer.set(s.player_id, []).get(s.player_id)).push(s);
  const rated = players.map((p) => ratingMap.get(p.id)?.rating).filter((r) => r != null).map(normalizeRating);
  const groupAvg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 3;
  const contribs = [...byPlayer.values()].map(contribution);
  const groupContrib = contribs.length ? contribs.reduce((a, b) => a + b, 0) / contribs.length : 0;
  const seen = new Set();

  return players.filter((p) => p && !seen.has(p.id) && seen.add(p.id)).map((p) => {
    const official = ratingMap.get(p.id);
    const guestRating = p.is_guest && p.rating != null ? normalizeRating(p.rating) : null;
    const prior = official?.rating != null ? normalizeRating(official.rating) : guestRating ?? groupAvg;
    const priorSource = official?.rating != null ? "official" : guestRating != null ? "guest" : "average";
    const rows = p.is_guest ? [] : byPlayer.get(p.id) || [];
    const n = rows.length;
    const w = n / (n + EVIDENCE_K);
    const performance = clamp(prior + (contribution(rows) - groupContrib), 1, 5);
    const strength = clamp((1 - w) * prior + w * performance, 1, 5);
    const style = styles.get?.(p.id) || null;
    const role = playerRole(p, style);
    const pos = (key) => (official?.[key] != null ? clamp(normalizeRating(official[key]) + (strength - prior), 1, 5) : strength);
    return {
      ...p,
      rating: strength,
      attack_rating: pos("attack_rating"),
      defense_rating: pos("defense_rating"),
      midfield_rating: pos("midfield_rating"),
      goalkeeper_rating: pos("goalkeeper_rating"),
      skills: role.gk && !(p.skills || []).includes("goalkeeper") ? [...(p.skills || []), "goalkeeper"] : (p.skills || []),
      balance: { strength: round1(strength), prior: round1(prior), priorSource, evidence: n, weight: Math.round(w * 100), line: role.line, gk: role.gk, newPlayer: priorSource === "average" && n === 0 },
    };
  });
}

/** Plain-language summary of how balanced a set of teams is. */
export function explainTeams(teams) {
  const sums = teams.map((t) => {
    const ps = t.players || [];
    const total = ps.reduce((s, p) => s + (p.balance?.strength ?? normalizeRating(p.rating)), 0);
    const lines = { Defender: 0, Midfielder: 0, Forward: 0 };
    ps.forEach((p) => { const l = p.balance?.line; if (lines[l] != null) lines[l] += 1; });
    return {
      name: t.name, size: ps.length, total: round1(total), avg: ps.length ? round1(total / ps.length) : 0,
      goalkeepers: ps.filter((p) => p.balance?.gk || p.preferred_position === "Goalkeeper").length,
      newPlayers: ps.filter((p) => p.balance?.newPlayer).length,
      pinned: ps.filter((p) => p.pinned).length,
      lines,
    };
  });
  const avgs = sums.map((s) => s.avg);
  const gap = avgs.length ? round1(Math.max(...avgs) - Math.min(...avgs)) : 0;
  const level = gap <= 0.15 ? "muy parejo" : gap <= 0.35 ? "parejo" : gap <= 0.6 ? "algo desigual" : "desigual";
  const notes = [];
  const gks = sums.map((s) => s.goalkeepers);
  if (gks.every((g) => g >= 1)) notes.push("Cada equipo tiene al menos un portero.");
  else if (gks.some((g) => g >= 1)) notes.push("No alcanzan los porteros para todos: se repartieron lo mejor posible.");
  else notes.push("No hay porteros declarados: van rotando.");
  const totalNew = sums.reduce((t, s) => t + s.newPlayers, 0);
  if (totalNew) notes.push(`${totalNew} jugador${totalNew === 1 ? "" : "es"} sin historial cuentan con el promedio del grupo (no se los penaliza).`);
  const pinned = sums.reduce((t, s) => t + s.pinned, 0);
  if (pinned) notes.push(`${pinned} fijado${pinned === 1 ? "" : "s"} por el organizador; el resto se reacomodó.`);
  const sizes = sums.map((s) => s.size);
  if (Math.max(...sizes) - Math.min(...sizes) > 1) notes.push("Los equipos no tienen la misma cantidad de jugadores.");
  return { teams: sums, gap, level, notes };
}
