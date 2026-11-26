import { describe, expect, it } from "vitest";
import {
  buildFifaCardData,
  buildFifaShareText,
  buildInviteCardData,
  buildInviteShareText,
  buildResultCardData,
  buildResultShareText,
  buildTeamsCardData,
  buildTeamsShareText,
} from "../share/shareData.js";
import { resolveShareTheme } from "../share/sharePalette.js";

describe("F5 Share & Invite V1 — pure builders & privacy guards", () => {
  const sampleMatch = {
    id: "match-123",
    group_id: "group-abc",
    title: "Chamusca de los Jueves",
    match_date: "2026-12-03",
    start_time: "20:00",
    venue: "Cancha Futeca Zona 14",
    max_players: 10,
  };

  describe("Priority A — Convocatorias", () => {
    it("hides group name by default and includes it only when admin enables it", () => {
      const hidden = buildInviteCardData({
        match: sampleMatch,
        confirmedCount: 7,
        capacity: 10,
        groupName: "Los Cracks Privados",
      });
      expect(hidden.groupName).toBeNull();
      expect(hidden.freeSpots).toBe(3);
      expect(hidden.venue).toBe("Cancha Futeca Zona 14");

      const hiddenText = buildInviteShareText(hidden);
      expect(hiddenText).not.toContain("Los Cracks Privados");
      expect(hiddenText).toContain("/partidos/match-123?group=group-abc");
      expect(hiddenText).not.toMatch(/admin|token|radar/i);

      const shown = buildInviteCardData({
        match: sampleMatch,
        confirmedCount: 7,
        capacity: 10,
        groupName: "Los Cracks Privados",
        includeGroupName: true,
        includeVenue: false,
      });
      expect(shown.groupName).toBe("Los Cracks Privados");
      expect(shown.venue).toBeNull();
      const shownText = buildInviteShareText(shown);
      expect(shownText).toContain("Los Cracks Privados");
      expect(shownText).not.toContain("Cancha Futeca Zona 14");
    });

    it("handles full match with waitlist cleanly", () => {
      const full = buildInviteCardData({
        match: sampleMatch,
        confirmedCount: 10,
        capacity: 10,
        waitlistCount: 2,
      });
      expect(full.freeSpots).toBe(0);
      expect(full.spotsHeadline).toContain("2 en espera");
      expect(full.ctaText).toContain("lista de espera");
    });
  });

  describe("Priority B — Equipos", () => {
    it("never exposes ratings, stars, or private contact info and supports 6+ players & pins", () => {
      const makeMembers = (prefix, count) =>
        Array.from({ length: count }, (_, i) => ({
          id: `${prefix}-${i + 1}`,
          name: `${prefix} Jugador Muy Largo ${i + 1}`,
          position: i === 0 ? "Goalkeeper" : "Forward",
          positionShort: i === 0 ? "POR" : "DEL",
          rating: 4,
          phone: "5555-9999",
          email: "privado@test.com",
        }));

      const data = buildTeamsCardData({
        match: sampleMatch,
        teams: [
          { name: "Equipo Verde", color: "#5be584", total_rating: 21, members: makeMembers("V", 6) },
          { name: "Equipo Azul", color: "#6cb4ff", total_rating: 20, members: makeMembers("A", 7) },
        ],
        pins: { "V-1": 0, "A-2": 1 },
      });

      expect(data.teams).toHaveLength(2);
      expect(data.totalPlayers).toBe(13);
      expect(data.teams[0].members[0].pinned).toBe(true);
      expect(data.teams[1].members[1].pinned).toBe(true);

      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain("total_rating");
      expect(serialized).not.toContain("5555-9999");
      expect(serialized).not.toContain("privado@test.com");

      const text = buildTeamsShareText(data);
      expect(text).not.toMatch(/estrella|★|rating/i);
      expect(text).toContain("[POR] V Jugador Muy Largo 1");
      expect(text).toContain("Equipo Azul (7):");
    });
  });

  describe("Priority C — Mi FIFA", () => {
    it("exports only sports name, self-declared style, and confirmed stats without contact info", () => {
      const profile = {
        id: "user-1",
        full_name: "Guillermo De León",
        nickname: "Guille",
        phone: "+502 5555-1234",
        email: "guille@privado.com",
        preferred_position: "Midfielder",
        avatar_url: "https://example.test/avatar.png",
      };
      const style = {
        secondary_position: "Forward",
        attack: 3,
        defense: 2,
        passing: 3,
        pace: 2,
        goalkeeping: 0,
      };
      const record = { played: 12, goals: 8, assists: 6, mvps: 2, cleanSheets: 0, officialRating: 4 };

      const withPhoto = buildFifaCardData({ profile, style, record, includePhoto: true });
      expect(withPhoto.name).toBe("Guille");
      expect(withPhoto.avatarUrl).toBe("https://example.test/avatar.png");
      expect(withPhoto.hasStyle).toBe(true);
      expect(withPhoto.verified.goals).toBe(8);
      expect(withPhoto.awards.length).toBeGreaterThan(0);

      const serialized = JSON.stringify(withPhoto);
      expect(serialized).not.toContain("5555-1234");
      expect(serialized).not.toContain("guille@privado.com");
      expect(serialized).not.toContain("officialRating");

      const withoutPhoto = buildFifaCardData({ profile, style, record, includePhoto: false });
      expect(withoutPhoto.avatarUrl).toBeNull();
      expect(withoutPhoto.initials).toBe("G");

      const text = buildFifaShareText(withPhoto);
      expect(text).toContain("Guille");
      expect(text).not.toContain("5555-1234");
    });
  });

  describe("Priority D — Resultados", () => {
    it("shows official MVP only when official and never invents one when absent", () => {
      const teams = [
        { name: "Verdes", color: "#5be584", members: [{ id: "p1", name: "Ana" }, { id: "p2", name: "Beto" }] },
        { name: "Azules", color: "#6cb4ff", members: [{ id: "p3", name: "Carlos" }, { id: "p4", name: "Diego" }] },
      ];
      const statsNoMvp = [
        { player_id: "p1", name: "Ana", goals: 3, assists: 1, mvp: false },
        { player_id: "p3", name: "Carlos", goals: 2, assists: 0, mvp: false },
      ];

      const noMvp = buildResultCardData({
        match: sampleMatch,
        teams,
        confirmedStats: statsNoMvp,
        confirmedCount: 10,
      });
      expect(noMvp.officialMvp).toBeNull();
      expect(noMvp.teams[0].goals).toBe(3);
      expect(noMvp.teams[1].goals).toBe(2);
      expect(buildResultShareText(noMvp)).not.toContain("MVP");

      const withMvp = buildResultCardData({
        match: sampleMatch,
        teams,
        confirmedStats: [{ player_id: "p1", name: "Ana", goals: 3, assists: 1, mvp: true }],
        confirmedCount: 10,
      });
      expect(withMvp.officialMvp).toBe("Ana");
      expect(buildResultShareText(withMvp)).toContain("MVP oficial: Ana");
    });
  });

  describe("Share palettes", () => {
    it("resolves all 4 Premium palettes and both designs", () => {
      for (const palette of ["neon", "midnight", "gold", "light"]) {
        for (const design of ["editorial", "command"]) {
          const theme = resolveShareTheme(palette, design);
          expect(theme.id).toBe(palette);
          expect(theme.design).toBe(design);
          expect(theme.accent).toMatch(/^#/);
        }
      }
    });
  });
});
