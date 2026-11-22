import { describe, expect, it } from "vitest";
import {
  allowedTeamCounts, canEditResult, championOf, computeStandings, firstMatchDate, generateChampionshipFixtures,
  knockoutUpdates, leagueComplete, nextStep, restingTeams, slotSources, validateScore, validTeamCount, weekdayOf,
} from "../tournament/championship.js";

const teams = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Equipo ${i + 1}`, team_order: i + 1 }));
const withIds = (fx) => fx.map((f, i) => ({ ...f, id: `m${i + 1}`, status: "pending", home_score: null, away_score: null }));

/** Plays a championship to the end: lower team number wins league games by 2-1 unless drawFn says draw; knockouts 1-0 home. */
function playOut(format, n, { drawFn = () => false, koScore = () => [1, 0] } = {}) {
  const ts = teams(n);
  let ms = withIds(generateChampionshipFixtures({ format, teams: ts, startDate: "2026-12-01", matchDay: "tuesday", matchTime: "19:00" }));
  const apply = () => {
    for (const u of knockoutUpdates(format, ts, ms)) ms = ms.map((m) => (m.id === u.id ? { ...m, ...u } : m));
  };
  for (let guard = 0; guard < 200; guard += 1) {
    apply();
    const next = ms.find((m) => m.status !== "played" && m.home_team_id && m.away_team_id);
    if (!next) break;
    let score;
    if (next.playoff_label || next.is_final || next.is_playoff) score = koScore(next);
    else if (drawFn(next)) score = [1, 1];
    else score = Number(next.home_team_id.slice(1)) < Number(next.away_team_id.slice(1)) ? [2, 1] : [1, 2];
    ms = ms.map((m) => (m.id === next.id ? { ...m, status: "played", home_score: score[0], away_score: score[1] } : m));
  }
  return { ts, ms };
}

describe("formats and team counts", () => {
  it("each format only accepts the sizes it can run", () => {
    expect(allowedTeamCounts("cuadrangular")).toEqual([4]);
    expect(allowedTeamCounts("playoffs_only")).toEqual([2, 4, 8]);
    expect(validTeamCount("league", 5)).toBe(true);
    expect(validTeamCount("league_playoffs", 3)).toBe(false);
    expect(() => generateChampionshipFixtures({ format: "playoffs_only", teams: teams(6), startDate: "2026-12-01" })).toThrow();
  });

  it("first matchday falls on the chosen weekday, then weekly", () => {
    expect(weekdayOf("2026-12-01")).toBe("tuesday");
    expect(firstMatchDate("2026-12-01", "saturday")).toBe("2026-12-05");
    const fx = generateChampionshipFixtures({ format: "league", teams: teams(4), startDate: "2026-12-01", matchDay: "saturday" });
    expect([...new Set(fx.map((f) => f.match_date))]).toEqual(["2026-12-05", "2026-12-12", "2026-12-19"]);
  });
});

describe("round robin", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    it(`${n} teams: everyone plays everyone exactly once, nobody twice in a round`, () => {
      const fx = generateChampionshipFixtures({ format: "league", teams: teams(n), startDate: "2026-12-01" });
      const pairs = fx.map((f) => [f.home_team_id, f.away_team_id].sort().join("-"));
      expect(new Set(pairs).size).toBe((n * (n - 1)) / 2);
      expect(pairs.length).toBe((n * (n - 1)) / 2);
      const rounds = [...new Set(fx.map((f) => f.round))];
      expect(rounds.length).toBe(n % 2 ? n : n - 1);
      for (const r of rounds) {
        const ids = fx.filter((f) => f.round === r).flatMap((f) => [f.home_team_id, f.away_team_id]);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  }

  it("odd number of teams: exactly one team rests each round", () => {
    const ts = teams(5);
    const fx = withIds(generateChampionshipFixtures({ format: "league", teams: ts, startDate: "2026-12-01" }));
    for (const r of [1, 2, 3, 4, 5]) expect(restingTeams(ts, fx.filter((m) => m.round === r))).toHaveLength(1);
  });
});

describe("full championships reach a champion", () => {
  const cases = [
    ["league", 4], ["league", 5], ["league", 6], ["league", 8],
    ["cuadrangular", 4],
    ["league_playoffs", 4], ["league_playoffs", 5], ["league_playoffs", 6], ["league_playoffs", 7], ["league_playoffs", 8],
    ["playoffs_only", 2], ["playoffs_only", 4], ["playoffs_only", 8],
  ];
  for (const [format, n] of cases) {
    it(`${format} with ${n} teams`, () => {
      const { ts, ms } = playOut(format, n);
      expect(ms.every((m) => m.status === "played")).toBe(true);
      const champ = championOf(format, ts, ms);
      expect(champ.status).toBe("decided");
      expect(ts.map((t) => t.id)).toContain(champ.teamId);
      expect(nextStep(format, ts, ms)).toMatch(/declaralo/);
    });
  }

  it("liga + playoffs seeds 1v4 and 2v3 from the real table, and the final from the semifinal winners", () => {
    // Make t4 top the table: t4 beats everyone, the rest by number.
    const ts = teams(6);
    let ms = withIds(generateChampionshipFixtures({ format: "league_playoffs", teams: ts, startDate: "2026-12-01" }));
    const sf1 = ms.find((m) => m.playoff_label === "Semifinal 1");
    expect([sf1.home_team_id, sf1.away_team_id]).toEqual([null, null]);
    const rank = { t4: 0, t1: 1, t2: 2, t3: 3, t5: 4, t6: 5 };
    ms = ms.map((m) => (m.playoff_label ? m : { ...m, status: "played", ...(rank[m.home_team_id] < rank[m.away_team_id] ? { home_score: 3, away_score: 0 } : { home_score: 0, away_score: 3 }) }));
    expect(leagueComplete(ms)).toBe(true);
    const ups = knockoutUpdates("league_playoffs", ts, ms);
    const get = (label) => ups.find((u) => u.id === ms.find((m) => m.playoff_label === label).id);
    expect([get("Semifinal 1").home_team_id, get("Semifinal 1").away_team_id]).toEqual(["t4", "t3"]);
    expect([get("Semifinal 2").home_team_id, get("Semifinal 2").away_team_id]).toEqual(["t1", "t2"]);
    expect(get("Final")).toBeUndefined(); // waits for the semifinal winners
  });

  it("cuadrangular final is 1º vs 2º of the table, not registration order", () => {
    const ts = teams(4);
    let ms = withIds(generateChampionshipFixtures({ format: "cuadrangular", teams: ts, startDate: "2026-12-01" }));
    const order = { t3: 0, t4: 1, t1: 2, t2: 3 };
    ms = ms.map((m) => (m.is_final ? m : { ...m, status: "played", ...(order[m.home_team_id] < order[m.away_team_id] ? { home_score: 2, away_score: 0 } : { home_score: 0, away_score: 2 }) }));
    const [u] = knockoutUpdates("cuadrangular", ts, ms);
    expect([u.home_team_id, u.away_team_id]).toEqual(["t3", "t4"]);
  });

  it("solo playoffs: later rounds stay empty until winners are known", () => {
    const ts = teams(8);
    const ms = withIds(generateChampionshipFixtures({ format: "playoffs_only", teams: ts, startDate: "2026-12-01" }));
    expect(ms.filter((m) => m.round === 1).every((m) => m.home_team_id && m.away_team_id)).toBe(true);
    expect(ms.filter((m) => m.round > 1).every((m) => !m.home_team_id && !m.away_team_id)).toBe(true);
    expect(slotSources("playoffs_only", ms).get(ms.find((m) => m.round === 2).id)[0]).toMatch(/Ganador Cuartos de final 1/);
    expect(ms.filter((m) => m.is_final)).toHaveLength(1);
  });
});

describe("draws, tie-breaks and validation", () => {
  it("league draws give 1 point each; the table uses points then goals for (existing rule)", () => {
    const ts = teams(4);
    const ms = withIds(generateChampionshipFixtures({ format: "league", teams: ts, startDate: "2026-12-01" }))
      .map((m) => ({ ...m, status: "played", home_score: 1, away_score: 1 }));
    const table = computeStandings(ts, ms);
    expect(table.every((r) => r.points === 3 && r.drawn === 3)).toBe(true);
    expect(championOf("league", ts, ms)).toMatchObject({ status: "tie" });
    expect(nextStep("league", ts, ms)).toMatch(/empatada/);
  });

  it("knockout games cannot be saved as a draw; league games can", () => {
    expect(validateScore("2", "2", true).ok).toBe(false);
    expect(validateScore("2", "2", false)).toMatchObject({ ok: true, home: 2, away: 2 });
    expect(validateScore("", "1", false).ok).toBe(false);
    expect(validateScore("-1", "1", false).ok).toBe(false);
    expect(validateScore("1.5", "1", false).ok).toBe(false);
  });

  it("knockout games never change the league table", () => {
    const { ts, ms } = playOut("league_playoffs", 4);
    const table = computeStandings(ts, ms);
    expect(table.reduce((s, r) => s + r.played, 0)).toBe(12); // 6 league games × 2 teams
  });
});

describe("corrections by an organizer", () => {
  it("a league result can be corrected (no double counting) until the knockout stage starts", () => {
    const ts = teams(4);
    let ms = withIds(generateChampionshipFixtures({ format: "league_playoffs", teams: ts, startDate: "2026-12-01" }));
    const first = ms[0];
    ms = ms.map((m) => (m.id === first.id ? { ...m, status: "played", home_score: 3, away_score: 0 } : m));
    expect(canEditResult("league_playoffs", ms[0], ms).ok).toBe(true);
    ms = ms.map((m) => (m.id === first.id ? { ...m, home_score: 0, away_score: 1 } : m));
    const table = computeStandings(ts, ms);
    expect(table.reduce((s, r) => s + r.played, 0)).toBe(2);
    expect(table.find((r) => r.tournament_team_id === first.away_team_id).points).toBe(3);
    expect(table.find((r) => r.tournament_team_id === first.home_team_id).points).toBe(0);
  });

  it("once a knockout game is played, league results are locked; a knockout result is locked once the winner played on", () => {
    const { ms } = playOut("league_playoffs", 4);
    const league = ms.find((m) => !m.playoff_label);
    expect(canEditResult("league_playoffs", league, ms)).toMatchObject({ ok: false });
    const sf = ms.find((m) => m.playoff_label === "Semifinal 1");
    expect(canEditResult("league_playoffs", sf, ms)).toMatchObject({ ok: false });
    const fin = ms.find((m) => m.playoff_label === "Final");
    expect(canEditResult("league_playoffs", fin, ms).ok).toBe(true);
  });

  it("correcting a semifinal before the final is played re-routes the final", () => {
    const ts = teams(4);
    let { ms } = playOut("playoffs_only", 4);
    // The final has not been played yet:
    ms = ms.map((m) => (m.is_final ? { ...m, status: "pending", home_score: null, away_score: null } : m));
    const sf1 = ms.find((m) => m.playoff_label === "Semifinal 1");
    expect(canEditResult("playoffs_only", sf1, ms).ok).toBe(true);
    ms = ms.map((m) => (m.id === sf1.id ? { ...m, home_score: 0, away_score: 2 } : m));
    const ups = knockoutUpdates("playoffs_only", ts, ms);
    expect(ups[0].home_team_id).toBe(sf1.away_team_id);
  });

  it("matches without both teams cannot be scored", () => {
    const ms = withIds(generateChampionshipFixtures({ format: "cuadrangular", teams: teams(4), startDate: "2026-12-01" }));
    const fin = ms.find((m) => m.is_final);
    expect(canEditResult("cuadrangular", fin, ms)).toMatchObject({ ok: false });
  });
});
