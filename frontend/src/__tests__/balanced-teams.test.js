import { describe, expect, it } from "vitest";
import { generateBalancedTeams, fairnessScore } from "../teamGeneration.js";
import { EVIDENCE_K, enrichPlayers, explainTeams, playerRole } from "../teams/balance.js";

const P = (id, pos = "Midfielder", extra = {}) => ({ id, nickname: id, preferred_position: pos, membership_is_active: true, ...extra });
const ratings = (pairs) => new Map(pairs.map(([id, rating]) => [id, { rating }]));
const statRows = (id, n, goals = 0) => Array.from({ length: n }, (_, i) => ({ player_id: id, match_id: `m${i}`, goals, assists: 0, mvp: false, clean_sheet: false }));

describe("strength with evidence", () => {
  it("a new player (no rating, no history) gets the group average, not a penalty", () => {
    const [a, , nu] = enrichPlayers([P("a"), P("b"), P("new")], { ratingMap: ratings([["a", 4], ["b", 2]]) });
    expect(nu.balance).toMatchObject({ strength: 3, priorSource: "average", evidence: 0, newPlayer: true });
    expect(a.balance.strength).toBe(4);
  });

  it("confirmed results weigh more as matches accumulate (w = n / (n + 5))", () => {
    const rm = ratings([["s", 3], ["x", 3]]);
    const base = [...statRows("x", 10, 0)];
    const few = enrichPlayers([P("s"), P("x")], { ratingMap: rm, stats: [...base, ...statRows("s", 1, 2)] }).find((p) => p.id === "s");
    const many = enrichPlayers([P("s"), P("x")], { ratingMap: rm, stats: [...base, ...statRows("s", 10, 2)] }).find((p) => p.id === "s");
    expect(few.balance.weight).toBe(Math.round((1 / (1 + EVIDENCE_K)) * 100));
    expect(many.balance.weight).toBe(Math.round((10 / (10 + EVIDENCE_K)) * 100));
    expect(many.balance.strength).toBeGreaterThan(few.balance.strength);
    expect(many.balance.strength).toBeLessThanOrEqual(5);
  });

  it("self-declared style never changes strength (it only sets role and goalkeepers)", () => {
    const styles = new Map([["s", { attack: 10, defense: 0, passing: 0, pace: 0, goalkeeping: 0 }], ["g", { attack: 0, defense: 1, passing: 1, pace: 1, goalkeeping: 7 }]]);
    const [s, g, plain] = enrichPlayers([P("s", "Flexible"), P("g", "Defender"), P("p")], { ratingMap: ratings([["s", 3], ["g", 3], ["p", 3]]), styles });
    expect(s.balance.strength).toBe(plain.balance.strength);
    expect(s.balance.line).toBe("Forward");
    expect(g.balance.gk).toBe(true);
    expect(g.skills).toContain("goalkeeper");
    expect(playerRole(P("x", "Forward"), { secondary_position: "Goalkeeper" }).gk).toBe(true);
  });

  it("duplicates are removed", () => {
    expect(enrichPlayers([P("a"), P("a"), P("b")])).toHaveLength(2);
    const t = generateBalancedTeams([...Array.from({ length: 10 }, (_, i) => P(`p${i}`)), P("p0")]);
    const ids = t.teams.flatMap((x) => x.players.map((p) => p.id));
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });
});

describe("generator", () => {
  const squad = () => {
    const ps = [P("gk1", "Goalkeeper"), P("gk2", "Goalkeeper"), ...Array.from({ length: 10 }, (_, i) => P(`p${i}`, ["Defender", "Midfielder", "Forward"][i % 3]))];
    const rm = ratings(ps.map((p, i) => [p.id, 1 + (i % 5)]));
    return enrichPlayers(ps, { ratingMap: rm });
  };

  it("spreads goalkeepers and keeps teams close", () => {
    const res = generateBalancedTeams(squad());
    expect(res.teams.map((t) => t.goalkeeper_count)).toEqual([1, 1]);
    expect(fairnessScore(res.teams)).toBeLessThanOrEqual(1);
    const ex = explainTeams(res.teams);
    expect(ex.notes).toContain("Cada equipo tiene al menos un portero.");
    expect(["muy parejo", "parejo"]).toContain(ex.level);
  });

  it("pinned players stay where the organizer put them; the rest is rebalanced", () => {
    const players = squad();
    const pins = { p0: 0, p1: 0, p2: 1 };
    const res = generateBalancedTeams(players, { pins });
    const teamOf = (id) => res.teams.findIndex((t) => t.players.some((p) => p.id === id));
    expect([teamOf("p0"), teamOf("p1"), teamOf("p2")]).toEqual([0, 0, 1]);
    expect(res.teams.flatMap((t) => t.players)).toHaveLength(12);
    expect(explainTeams(res.teams).notes.some((n) => /3 fijados/.test(n))).toBe(true);
  });

  it("a pin to a team that does not exist is ignored safely", () => {
    const res = generateBalancedTeams(squad(), { pins: { p0: 7 } });
    expect(res.teams.flatMap((t) => t.players)).toHaveLength(12);
  });

  it("explanation mentions players without history", () => {
    const ps = enrichPlayers(Array.from({ length: 10 }, (_, i) => P(`n${i}`)));
    const ex = explainTeams(generateBalancedTeams(ps).teams);
    expect(ex.notes.some((n) => /sin historial cuentan con el promedio/.test(n))).toBe(true);
    expect(ex.notes).toContain("No hay porteros declarados: van rotando.");
  });
});
