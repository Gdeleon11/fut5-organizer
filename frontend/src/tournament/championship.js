/*
 * Friendly championships — pure competition logic (no I/O).
 *
 * Rules kept from the existing module (not invented here):
 *   - 3 points per win, 1 per draw, 0 per loss (tournamentEngine.updateStandings).
 *   - Table order: points, then goals for (api.listStandings order). Ties beyond that fall back
 *     to registration order so the table is stable; see docs/F5_CHAMPIONSHIPS.md for the proposed
 *     goal-difference rule, which is NOT applied until approved.
 *   - Liga + Playoffs: Semifinal 1 = 1º vs 4º, Semifinal 2 = 2º vs 3º, then a Final.
 *   - Cuadrangular: 4 teams round robin + Final.
 *   - Solo Playoffs: 2, 4 or 8 teams, paired in registration order (1v2, 3v4, …).
 *
 * Fixes over tournamentEngine.generateFixtures: playoff slots start empty and are filled from the
 * real table / winners (they used to be fixed by registration order before any game), the first
 * matchday falls on the chosen weekday, and knockout rounds no longer assume the home team wins.
 */

const DAY_MS = 86400000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const FORMAT_RULES = {
  cuadrangular: { sizes: [4], label: "4 equipos" },
  league: { min: 3, max: 12, label: "3 a 12 equipos" },
  league_playoffs: { min: 4, max: 12, label: "4 a 12 equipos" },
  playoffs_only: { sizes: [2, 4, 8], label: "2, 4 u 8 equipos" },
};

export function allowedTeamCounts(format) {
  const r = FORMAT_RULES[format];
  if (!r) return [];
  if (r.sizes) return r.sizes;
  return Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i);
}

export function validTeamCount(format, n) {
  return allowedTeamCounts(format).includes(Number(n));
}

export function weekdayOf(isoDate) {
  if (!isoDate) return null;
  return WEEKDAYS[new Date(`${isoDate}T12:00:00Z`).getUTCDay()];
}

const iso = (d) => d.toISOString().slice(0, 10);
const dateOf = (isoDate) => new Date(`${isoDate}T12:00:00Z`);

/** First date on or after start that falls on matchDay (defaults to the start date's own weekday). */
export function firstMatchDate(startDate, matchDay) {
  const start = dateOf(startDate);
  const target = WEEKDAYS.indexOf(matchDay || weekdayOf(startDate));
  const diff = target < 0 ? 0 : ((target - start.getUTCDay()) % 7 + 7) % 7;
  return iso(new Date(start.getTime() + diff * DAY_MS));
}

/** Weekly dates: one per round. */
function roundDates(startDate, matchDay, count) {
  const first = dateOf(firstMatchDate(startDate, matchDay));
  return Array.from({ length: count }, (_, i) => iso(new Date(first.getTime() + i * 7 * DAY_MS)));
}

/** Circle-method round robin; with an odd count one team rests each round. */
export function roundRobin(teams) {
  const list = [...teams];
  if (list.length % 2 !== 0) list.push(null);
  const rounds = [];
  const half = list.length / 2;
  for (let r = 0; r < list.length - 1; r += 1) {
    const games = [];
    for (let i = 0; i < half; i += 1) {
      const a = list[i];
      const b = list[list.length - 1 - i];
      if (a && b) games.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(games);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

const KO_LABELS = { 8: ["Cuartos de final 1", "Cuartos de final 2", "Cuartos de final 3", "Cuartos de final 4"], 4: ["Semifinal 1", "Semifinal 2"], 2: ["Final"] };

export function generateChampionshipFixtures({ format, teams, startDate, matchDay, matchTime = null, venue = null }) {
  if (!validTeamCount(format, teams.length)) {
    throw new Error(`El formato ${format} admite ${FORMAT_RULES[format]?.label || "otra cantidad de equipos"}.`);
  }
  if (!startDate) throw new Error("Falta la fecha de inicio.");
  const base = (round, order, extra) => ({ round, match_order: order, match_time: matchTime || null, venue: venue || null, ...extra });
  const out = [];
  let round = 1;

  if (format !== "playoffs_only") {
    const rr = roundRobin(teams);
    const koRounds = format === "cuadrangular" ? 1 : format === "league_playoffs" ? 2 : 0;
    const dates = roundDates(startDate, matchDay, rr.length + koRounds);
    rr.forEach((games, r) => {
      games.forEach((g, i) => out.push(base(round, i + 1, { home_team_id: g.home.id, away_team_id: g.away.id, match_date: dates[r] })));
      round += 1;
    });
    if (format === "cuadrangular") {
      out.push(base(round, 1, { home_team_id: null, away_team_id: null, match_date: dates[round - 1], is_playoff: true, is_final: true, playoff_label: "Final" }));
    }
    if (format === "league_playoffs") {
      out.push(base(round, 1, { home_team_id: null, away_team_id: null, match_date: dates[round - 1], is_playoff: true, playoff_label: "Semifinal 1" }));
      out.push(base(round, 2, { home_team_id: null, away_team_id: null, match_date: dates[round - 1], is_playoff: true, playoff_label: "Semifinal 2" }));
      round += 1;
      out.push(base(round, 1, { home_team_id: null, away_team_id: null, match_date: dates[round - 1], is_playoff: true, is_final: true, playoff_label: "Final" }));
    }
    return out;
  }

  // Solo Playoffs: first round paired in registration order; later rounds wait for winners.
  let size = teams.length;
  const totalRounds = Math.log2(size);
  const dates = roundDates(startDate, matchDay, totalRounds);
  for (let r = 0; r < totalRounds; r += 1) {
    const games = size / 2;
    for (let i = 0; i < games; i += 1) {
      const first = r === 0;
      out.push(base(round, i + 1, {
        home_team_id: first ? teams[i * 2].id : null,
        away_team_id: first ? teams[i * 2 + 1].id : null,
        match_date: dates[r],
        is_playoff: true,
        is_final: games === 1,
        playoff_label: KO_LABELS[size]?.[i] || `Ronda ${round} · ${i + 1}`,
      }));
    }
    size /= 2;
    round += 1;
  }
  return out;
}

export const isKnockout = (m) => Boolean(m?.is_playoff || m?.is_final || m?.playoff_label);
export const isPlayed = (m) => m?.status === "played" && m.home_score != null && m.away_score != null;

export function winnerOf(m) {
  if (!isPlayed(m)) return null;
  if (m.home_score > m.away_score) return m.home_team_id;
  if (m.away_score > m.home_score) return m.away_team_id;
  return null;
}
export function loserOf(m) {
  const w = winnerOf(m);
  if (!w) return null;
  return w === m.home_team_id ? m.away_team_id : m.home_team_id;
}

const byRoundOrder = (a, b) => (a.round - b.round) || ((a.match_order || 0) - (b.match_order || 0));
export const leagueMatches = (matches = []) => matches.filter((m) => !isKnockout(m));
export const knockoutMatches = (matches = []) => matches.filter(isKnockout).sort(byRoundOrder);

/** Existing table rule: points, then goals for; registration order only to keep ties stable. */
export function compareStandings(a, b) {
  return (b.points - a.points) || (b.goals_for - a.goals_for) || ((a.team_order ?? 0) - (b.team_order ?? 0));
}

/** League table derived from every played league-phase match (knockout games never count). */
export function computeStandings(teams = [], matches = []) {
  const rows = new Map(teams.map((t) => [t.id, {
    tournament_team_id: t.id, team_order: t.team_order ?? 0, name: t.name,
    played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0,
  }]));
  for (const m of leagueMatches(matches)) {
    if (!isPlayed(m)) continue;
    const h = rows.get(m.home_team_id); const a = rows.get(m.away_team_id);
    if (!h || !a) continue;
    const hs = Number(m.home_score); const as = Number(m.away_score);
    h.played += 1; a.played += 1;
    h.goals_for += hs; h.goals_against += as; a.goals_for += as; a.goals_against += hs;
    if (hs > as) { h.won += 1; h.points += 3; a.lost += 1; }
    else if (hs < as) { a.won += 1; a.points += 3; h.lost += 1; }
    else { h.drawn += 1; a.drawn += 1; h.points += 1; a.points += 1; }
  }
  return [...rows.values()].map((r) => ({ ...r, goal_diff: r.goals_for - r.goals_against })).sort(compareStandings);
}

/** True when two rows cannot be separated by the existing rule (points + goals for). */
export const tiedOnRule = (a, b) => Boolean(a && b && a.points === b.points && a.goals_for === b.goals_for);

export function leagueComplete(matches = []) {
  const lm = leagueMatches(matches);
  return lm.length > 0 && lm.every(isPlayed);
}

const findLabel = (ko, label) => ko.find((m) => m.playoff_label === label);

/**
 * Participants every knockout slot should have right now. Seeds come from the final table
 * (only once the league phase is complete) and from winners of the previous round.
 */
export function expectedKnockoutSlots(format, teams = [], matches = []) {
  const ko = knockoutMatches(matches);
  const slots = new Map();
  const table = computeStandings(teams, matches);
  const done = leagueComplete(matches);
  const seed = (n) => (done ? table[n - 1]?.tournament_team_id || null : null);

  if (format === "cuadrangular") {
    const final = ko.find((m) => m.is_final) || ko[0];
    if (final) slots.set(final.id, [seed(1), seed(2)]);
  } else if (format === "league_playoffs") {
    const sf1 = findLabel(ko, "Semifinal 1"); const sf2 = findLabel(ko, "Semifinal 2"); const fin = findLabel(ko, "Final");
    if (sf1) slots.set(sf1.id, [seed(1), seed(4)]);
    if (sf2) slots.set(sf2.id, [seed(2), seed(3)]);
    if (fin) slots.set(fin.id, [winnerOf(sf1), winnerOf(sf2)]);
  } else if (format === "playoffs_only") {
    const rounds = [...new Set(ko.map((m) => m.round))].sort((a, b) => a - b);
    rounds.forEach((r, ri) => {
      if (ri === 0) return;
      const prev = ko.filter((m) => m.round === rounds[ri - 1]);
      ko.filter((m) => m.round === r).forEach((m, i) => {
        slots.set(m.id, [winnerOf(prev[i * 2]), winnerOf(prev[i * 2 + 1])]);
      });
    });
  }
  return slots;
}

/** Updates needed so pending knockout slots match the table/winners. Played games are never touched. */
export function knockoutUpdates(format, teams, matches) {
  const slots = expectedKnockoutSlots(format, teams, matches);
  const updates = [];
  for (const m of matches) {
    if (!slots.has(m.id) || isPlayed(m)) continue;
    const [home, away] = slots.get(m.id);
    if ((m.home_team_id || null) !== home || (m.away_team_id || null) !== away) {
      updates.push({ id: m.id, home_team_id: home, away_team_id: away });
    }
  }
  return updates;
}

/** Where a knockout match's teams come from, for "Por definir" slots. */
export function slotSources(format, matches = []) {
  const ko = knockoutMatches(matches);
  const src = new Map();
  if (format === "cuadrangular") {
    const fin = ko.find((m) => m.is_final) || ko[0];
    if (fin) src.set(fin.id, ["1º de la tabla", "2º de la tabla"]);
  } else if (format === "league_playoffs") {
    const sf1 = findLabel(ko, "Semifinal 1"); const sf2 = findLabel(ko, "Semifinal 2"); const fin = findLabel(ko, "Final");
    if (sf1) src.set(sf1.id, ["1º de la tabla", "4º de la tabla"]);
    if (sf2) src.set(sf2.id, ["2º de la tabla", "3º de la tabla"]);
    if (fin) src.set(fin.id, ["Ganador Semifinal 1", "Ganador Semifinal 2"]);
  } else if (format === "playoffs_only") {
    const rounds = [...new Set(ko.map((m) => m.round))].sort((a, b) => a - b);
    rounds.forEach((r, ri) => {
      if (ri === 0) return;
      const prev = ko.filter((m) => m.round === rounds[ri - 1]);
      ko.filter((m) => m.round === r).forEach((m, i) => {
        src.set(m.id, [`Ganador ${prev[i * 2]?.playoff_label || "llave"}`, `Ganador ${prev[i * 2 + 1]?.playoff_label || "llave"}`]);
      });
    });
  }
  return src;
}

/** Score input validation. Knockout games need a winner (enter the decisive score). */
export function validateScore(home, away, knockout) {
  const parse = (v) => (v === "" || v == null ? NaN : Number(v));
  const h = parse(home); const a = parse(away);
  if (!Number.isInteger(h) || !Number.isInteger(a)) return { ok: false, error: "Ingresá los goles de ambos equipos." };
  if (h < 0 || a < 0 || h > 99 || a > 99) return { ok: false, error: "Los goles van de 0 a 99." };
  if (knockout && h === a) return { ok: false, error: "En eliminatoria tiene que haber un ganador. Cargá el resultado que define el partido (por ejemplo, incluyendo penales)." };
  return { ok: true, home: h, away: a };
}

/** Whether a result can be entered or corrected without breaking a later stage. */
export function canEditResult(format, match, matches = []) {
  if (!match.home_team_id || !match.away_team_id) return { ok: false, reason: "Los equipos de este partido todavía no están definidos." };
  if (!isPlayed(match)) return { ok: true };
  const ko = knockoutMatches(matches);
  if (!isKnockout(match)) {
    if (ko.some(isPlayed)) return { ok: false, reason: "Ya se jugó la fase eliminatoria: la tabla quedó cerrada." };
    return { ok: true };
  }
  // A knockout result can be corrected while the game it feeds has not been played.
  const w = winnerOf(match);
  const fedPlayed = ko.some((m) => m.round > match.round && isPlayed(m) && (m.home_team_id === w || m.away_team_id === w));
  if (fedPlayed) return { ok: false, reason: "El ganador ya jugó la ronda siguiente. Corregí primero ese resultado." };
  return { ok: true };
}

/** Champion once the competition is decided: final winner, or league leader when all games are played. */
export function championOf(format, teams = [], matches = []) {
  if (!matches.length) return { status: "none" };
  if (format === "league") {
    if (!leagueComplete(matches)) return { status: "pending" };
    const table = computeStandings(teams, matches);
    if (tiedOnRule(table[0], table[1])) {
      return { status: "tie", teamIds: table.filter((r) => tiedOnRule(r, table[0])).map((r) => r.tournament_team_id) };
    }
    return { status: "decided", teamId: table[0].tournament_team_id, runnerUpId: table[1]?.tournament_team_id || null };
  }
  const final = knockoutMatches(matches).find((m) => m.is_final) || knockoutMatches(matches).at(-1);
  if (!final || !isPlayed(final)) return { status: "pending" };
  return { status: "decided", teamId: winnerOf(final), runnerUpId: loserOf(final) };
}

/** One short sentence telling the organizer what to do next. */
export function nextStep(format, teams = [], matches = []) {
  if (!matches.length) return "Generá el calendario para empezar.";
  const champ = championOf(format, teams, matches);
  if (champ.status === "decided") return "Campeonato definido: declaralo para cerrarlo.";
  if (champ.status === "tie") return "La liga terminó empatada en puntos y goles a favor: definí el campeón con tu grupo antes de cerrarlo.";
  const pending = [...matches].sort(byRoundOrder).find((m) => !isPlayed(m) && m.home_team_id && m.away_team_id);
  if (pending) {
    return isKnockout(pending)
      ? `Cargá el resultado de ${pending.playoff_label || "la eliminatoria"}.`
      : `Cargá los resultados de la Jornada ${pending.round}.`;
  }
  return "Esperando que se definan los equipos de la siguiente ronda.";
}

/** Teams resting in a league round (odd number of teams). */
export function restingTeams(teams = [], roundMatches = []) {
  if (roundMatches.some(isKnockout)) return [];
  const playing = new Set(roundMatches.flatMap((m) => [m.home_team_id, m.away_team_id]));
  return teams.filter((t) => !playing.has(t.id));
}
