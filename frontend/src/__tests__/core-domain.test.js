import { describe, it, expect } from "vitest";
import { generateBalancedTeams, normalizeRating, fairnessScore } from "../teamGeneration.js";
import { generateFixtures, updateStandings } from "../tournamentEngine.js";
import { canAccessMatch } from "../tags.js";
import { isFullMatch, waitlistPosition, fineLabel, fineReasonLabel } from "../utils.js";

function makePlayers(count, gkCount = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-${i + 1}`,
    full_name: `Jugador ${i + 1}`,
    nickname: `J${i + 1}`,
    preferred_position: i < gkCount ? "Goalkeeper" : ["Forward", "Midfielder", "Defender"][i % 3],
    rating: ((i % 4) + 1),
    skills: i < gkCount ? ["goalkeeper"] : [],
  }));
}

describe("Core Domain — Team Generation (Heuristic Fallback)", () => {
  it("generates 2 balanced teams for 10 players and spreads goalkeepers", () => {
    const res = generateBalancedTeams(makePlayers(10, 2));
    expect(res.team_count).toBe(2);
    expect(res.teams).toHaveLength(2);
    expect(res.teams[0].players).toHaveLength(5);
    expect(res.teams[1].players).toHaveLength(5);
    expect(res.teams[0].goalkeeper_count).toBe(1);
    expect(res.teams[1].goalkeeper_count).toBe(1);
    expect(fairnessScore(res.teams)).toBeLessThanOrEqual(1.5);
  });

  it("generates 3 teams for 15 players and 4 teams for 20 players without duplicates", () => {
    for (const [n, expectedTeams] of [[15, 3], [20, 4]]) {
      const res = generateBalancedTeams(makePlayers(n, expectedTeams));
      expect(res.team_count).toBe(expectedTeams);
      const ids = res.teams.flatMap((t) => t.players.map((p) => p.id));
      expect(ids).toHaveLength(n);
      expect(new Set(ids).size).toBe(n);
    }
  });

  it("normalizes ratings from 1-5 and 1-100 scales cleanly", () => {
    expect(normalizeRating(4)).toBe(4);
    expect(normalizeRating(80)).toBe(4);
    expect(normalizeRating(0)).toBe(2.5);
  });
});

describe("Core Domain — Tournament Engine (Date & Standings Regressions)", () => {
  const teams = [
    { id: "t1", name: "Equipo 1" },
    { id: "t2", name: "Equipo 2" },
    { id: "t3", name: "Equipo 3" },
    { id: "t4", name: "Equipo 4" },
  ];

  it("produces valid ISO YYYY-MM-DD dates across all rounds (no Invalid Date)", () => {
    for (const format of ["cuadrangular", "league", "league_playoffs", "playoffs_only"]) {
      const fixtures = generateFixtures(format, teams, "2026-11-23", "monday", "19:00", "Plaza 1");
      expect(fixtures.length).toBeGreaterThan(0);
      for (const f of fixtures) {
        expect(typeof f.match_date).toBe("string");
        expect(f.match_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(Date.parse(f.match_date))).toBe(false);
      }
    }
  });

  it("updates league standings accurately for wins, draws, and goal difference", () => {
    const standings = [
      { tournament_team_id: "t1", played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 },
      { tournament_team_id: "t2", played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 },
    ];
    updateStandings(standings, "t1", "t2", 4, 2);
    expect(standings[0]).toMatchObject({ played: 1, won: 1, points: 3, goals_for: 4, goals_against: 2 });
    expect(standings[1]).toMatchObject({ played: 1, lost: 1, points: 0, goals_for: 2, goals_against: 4 });
    updateStandings(standings, "t1", "t2", 1, 1);
    expect(standings[0].points).toBe(4);
    expect(standings[1].points).toBe(1);
  });
});

describe("Core Domain — Tags, Waitlist, and Fines Helpers", () => {
  it("enforces match allowed_tags for players while granting access to admins", () => {
    const restrictedMatch = { allowed_tags: ["residente"] };
    expect(canAccessMatch(restrictedMatch, { group_tags: ["residente"] }, false)).toBe(true);
    expect(canAccessMatch(restrictedMatch, { group_tags: ["veterano"] }, false)).toBe(false);
    expect(canAccessMatch(restrictedMatch, { group_tags: [] }, true)).toBe(true);
  });

  it("calculates full match capacity and waitlist order accurately", () => {
    const match = { id: "m1", max_players: 2 };
    const attendances = [
      { match_id: "m1", profile_id: "u1", status: "confirmed", created_at: "2026-11-01T10:00:00Z" },
      { match_id: "m1", profile_id: "u2", status: "checked_in", created_at: "2026-11-01T10:05:00Z" },
      { match_id: "m1", profile_id: "u3", status: "waitlist", created_at: "2026-11-01T10:10:00Z" },
      { match_id: "m1", profile_id: "u4", status: "waitlist", created_at: "2026-11-01T10:15:00Z" },
    ];
    expect(isFullMatch(match, attendances)).toBe(true);
    expect(waitlistPosition("m1", "u3", attendances)).toBe(1);
    expect(waitlistPosition("m1", "u4", attendances)).toBe(2);
    expect(waitlistPosition("m1", "u1", attendances)).toBeNull();
  });

  it("formats fine statuses and reasons consistently", () => {
    expect(fineLabel("open")).toBe("Pendiente");
    expect(fineLabel("paid")).toBe("Pagada");
    expect(fineReasonLabel("late_cancel")).toBe("Canceló tarde");
  });
});
