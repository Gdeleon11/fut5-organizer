import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { computePlayerStats, canSeePrivate, playerTimeline, SORTERS } from "../players/playerStats.js";
import { EvolutionStrip } from "../components/profile/ProfileBlocks.jsx";
import PlayersPage from "../pages/PlayersPage.jsx";

const profiles = [
  { id: "a", nickname: "Ana", full_name: "Ana Pérez", phone: "5555-0001", preferred_position: "Forward", membership_is_active: true, group_tags: ["martes"] },
  { id: "b", nickname: "Beto", full_name: "Roberto Ruiz", phone: "5555-0002", preferred_position: "Goalkeeper", membership_is_active: true, group_tags: [] },
  { id: "c", nickname: "Caro", full_name: "Carolina", phone: "5555-0003", preferred_position: "Defender", membership_is_active: false, group_tags: [] },
];
const matches = [
  { id: "m1", match_date: "2026-11-01", title: "Uno" }, { id: "m2", match_date: "2026-11-08", title: "Dos" }, { id: "m3", match_date: "2026-11-15", title: "Tres" }, { id: "m4", match_date: "2026-11-22", title: "Cuatro" },
];
const matchStats = [
  { id: "s1", match_id: "m1", player_id: "a", goals: 2, assists: 1, mvp: true },
  { id: "s2", match_id: "m2", player_id: "a", goals: 1, assists: 0, clean_sheet: false },
  { id: "s3", match_id: "m3", player_id: "a", goals: 0, assists: 2 },
  { id: "s4", match_id: "m1", player_id: "b", goals: 0, assists: 0, clean_sheet: true },
];
const attendances = [
  { id: "x1", match_id: "m1", profile_id: "a", status: "checked_in" },
  { id: "x2", match_id: "m2", profile_id: "a", status: "confirmed" },
  { id: "x3", match_id: "m4", profile_id: "a", status: "canceled" },
  { id: "x4", match_id: "m1", profile_id: "b", status: "confirmed" },
  { id: "x5", match_id: "m2", profile_id: "b", status: "no_show" },
];
const votes = new Map([["a", { average: 4.25, count: 4 }]]);

describe("player stats (same formulas as the former ranking)", () => {
  it("aggregates verified stats and reliability", () => {
    const a = computePlayerStats(profiles[0], { matchStats, attendances, voteScoreMap: votes });
    expect(a).toMatchObject({ goals: 3, assists: 3, mvps: 1, cleanSheets: 0, matchesPlayed: 2, confirmedAttendances: 2, canceledAttendances: 1, noShows: 0, reliabilityScore: 1, voteAverage: 4.3, voteCount: 4 });
    const b = computePlayerStats(profiles[1], { matchStats, attendances, voteScoreMap: votes });
    expect(b).toMatchObject({ cleanSheets: 1, matchesPlayed: 1, noShows: 1, reliabilityScore: -1, voteAverage: 0 });
  });
  it("keeps the ranking tie-break order", () => {
    const rows = profiles.map((p) => computePlayerStats(p, { matchStats, attendances, voteScoreMap: votes }));
    expect([...rows].sort(SORTERS.goals).map((r) => r.profile.id)[0]).toBe("a");
    expect([...rows].sort(SORTERS.cleanSheets).map((r) => r.profile.id)[0]).toBe("b");
  });
  it("only shows evolution with enough recorded matches", () => {
    const tl = playerTimeline("a", { matchStats, matches });
    expect(tl.map((t) => t.date)).toEqual(["2026-11-01", "2026-11-08", "2026-11-15"]);
    const { container, rerender } = render(<EvolutionStrip timeline={tl.slice(0, 2)} />);
    expect(container.textContent).toMatch(/al menos 3 partidos/);
    rerender(<EvolutionStrip timeline={tl} />);
    expect(container.querySelectorAll(".pf-evo-col").length).toBe(3);
  });
  it("private data is for the player themself or admins", () => {
    expect(canSeePrivate({ viewerId: "a", targetId: "a", isAdmin: false })).toBe(true);
    expect(canSeePrivate({ viewerId: "a", targetId: "b", isAdmin: false })).toBe(false);
    expect(canSeePrivate({ viewerId: "a", targetId: "b", isAdmin: true })).toBe(true);
  });
});

describe("PlayersPage", () => {
  const base = {
    activeGroupId: "g", attendances, fines: [{ id: "f1", profile_id: "b", reason: "no_show", status: "open", amount: 25 }], matches, profiles,
    ratingMap: new Map(), voteScoreMap: votes, userVoteMap: new Map(), skills: [], matchStats, onVote: vi.fn(),
    onUpdateMember: vi.fn(), onUpdateProfile: vi.fn(), onAssignRating: vi.fn(), onAddSkill: vi.fn(), onRemoveSkill: vi.fn(), onCreateGroupTag: vi.fn(),
  };

  it("directory searches and filters active/inactive", () => {
    render(<PlayersPage {...base} isAdmin={false} isSuperAdmin={false} currentProfileId="a" />);
    expect(screen.getByText("2 jugadores")).toBeTruthy(); // active by default
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByText("3 jugadores")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Buscar jugador"), { target: { value: "beto" } });
    expect(screen.getByText("1 jugador")).toBeTruthy();
  });

  it("a player viewing another player sees no phone, fines or admin actions", () => {
    render(<PlayersPage {...base} isAdmin={false} isSuperAdmin={false} currentProfileId="a" />);
    fireEvent.click(screen.getAllByRole("button", { name: /Beto/ })[0]);
    expect(screen.queryByText("5555-0002")).toBeNull();
    expect(screen.queryByText(/Multas/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Desactivar jugador/ })).toBeNull();
    expect(screen.getByText("Estadísticas verificadas")).toBeTruthy();
  });

  it("admins see private data and use the real member handler", () => {
    const onUpdateMember = vi.fn();
    render(<PlayersPage {...base} onUpdateMember={onUpdateMember} isAdmin isSuperAdmin={false} currentProfileId="a" />);
    fireEvent.click(screen.getAllByRole("button", { name: /Beto/ })[0]);
    expect(screen.getByText("5555-0002")).toBeTruthy();
    expect(screen.getByText(/Multas \(1\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar jugador" }));
    expect(onUpdateMember).toHaveBeenCalledWith("b", { is_active: false });
  });

  it("ranking uses verified stats and shows the podium", () => {
    render(<PlayersPage {...base} isAdmin={false} isSuperAdmin={false} currentProfileId="a" />);
    fireEvent.click(screen.getByRole("button", { name: /Ranking/ }));
    const podium = screen.getByLabelText("Destacados del grupo");
    expect(within(podium).getByText("Goleador").closest("button").textContent).toMatch(/Ana.*3/);
  });
});
