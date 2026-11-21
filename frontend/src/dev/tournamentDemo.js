/* DEV-only demo tournaments for local screenshots / Playwright (never imported in production builds).
 * Fixtures and standings are produced by the real tournamentEngine so the demo follows the same rules. */
import { generateFixtures, updateStandings } from "../tournamentEngine.js";

const T_LEAGUE = "demo-tn-liga";
const T_CUP = "demo-tn-copa";
const T_DRAFT = "demo-tn-borrador";

export function demoTournaments() {
  return [
    { id: T_LEAGUE, name: "Liga Apertura 2026", format: "league_playoffs", status: "active", start_date: "2026-10-05", match_day: "monday", match_time: "19:00", venue: "Plaza 1 - Sintética", team_count: 4 },
    { id: T_CUP, name: "Copa Relámpago", format: "playoffs_only", status: "active", start_date: "2026-11-02", match_day: "saturday", match_time: "10:00", venue: "Plaza 3 - Domo Pro", team_count: 4 },
    { id: T_DRAFT, name: "Torneo de Verano", format: "cuadrangular", status: "draft", start_date: "2027-01-10", match_day: "sunday", match_time: "09:00", venue: "", team_count: 4 },
  ];
}

const SCORES = {
  [T_LEAGUE]: [[3, 1], [2, 2], [1, 0], [0, 2], [4, 3], [1, 1], [2, 1], [1, 2], null],
  [T_CUP]: [[2, 1], [0, 3], null],
};

export function demoTournamentDetail(id, profiles = []) {
  const t = demoTournaments().find((x) => x.id === id);
  if (!t || t.status === "draft") return { teams: [], matches: [], standings: [], members: [] };
  const names = id === T_CUP ? ["Rayos", "Halcones", "Titanes", "Cóndores"] : ["Verde", "Azul", "Rojo", "Dorado"];
  const teams = names.map((name, i) => ({ id: `${id}-team-${i}`, tournament_id: id, name, team_order: i + 1 }));
  const fixtures = generateFixtures(t.format, teams, t.start_date, t.match_day, t.match_time, t.venue);
  let standings = teams.map((team, i) => ({ id: `${id}-st-${i}`, tournament_team_id: team.id, tournament_team: team, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }));
  const matches = fixtures.map((f, i) => {
    const score = SCORES[id][i];
    const m = { ...f, id: `${id}-m-${i}`, tournament_id: id, status: score ? "played" : "pending", home_score: score?.[0] ?? null, away_score: score?.[1] ?? null };
    if (id === T_CUP && f.round === 2) { m.home_team_id = teams[0].id; m.away_team_id = teams[3].id; } // winners advance
    if (score && m.home_team_id && m.away_team_id && !f.is_playoff) standings = updateStandings(standings, m.home_team_id, m.away_team_id, score[0], score[1]);
    return m;
  });
  if (id === T_LEAGUE) { const final = matches.find((m) => m.playoff_label === "Final"); if (final) { final.home_team_id = teams[0].id; final.away_team_id = teams[2].id; } }
  standings.sort((a, b) => b.points - a.points || b.goals_for - a.goals_for);
  const active = profiles.filter((p) => p.membership_is_active !== false);
  const members = active.map((p, i) => ({ id: `${id}-mem-${i}`, tournament_team_id: teams[i % teams.length].id, profile_id: p.id, profiles: p }));
  return { teams, matches, standings, members };
}
