import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { buildMatchDetailModel } from "../matchday/matchDetailModel.js";
import MatchDetail from "../pages/MatchDetail.jsx";

const NOW = new Date(2026, 10, 19, 12, 0, 0);
const match = { id: "m1", title: "Plaza 1", venue: "Plaza 1", match_date: "2026-11-19", start_time: "19:00", max_players: 10, status: "upcoming", group_id: "g1" };
const profiles = [
  { id: "me", nickname: "Yo", preferred_position: "Forward" },
  { id: "p2", nickname: "Dos", preferred_position: "Goalkeeper" },
  { id: "p3", nickname: "Tres", preferred_position: "Defender" },
];
const byId = new Map(profiles.map((p) => [p.id, p]));
const attendances = [
  { id: "a1", match_id: "m1", profile_id: "me", status: "confirmed", created_at: "2026-11-01T10:00:00Z" },
  { id: "a2", match_id: "m1", profile_id: "p2", status: "checked_in", created_at: "2026-11-01T09:00:00Z" },
  { id: "a3", match_id: "m1", profile_id: "p3", status: "waitlist", created_at: "2026-11-01T11:00:00Z" },
];
const teams = [
  { id: "t1", name: "Verde", color: "#22c55e", team_members: [{ id: "tm1", profile_id: "me", profiles: profiles[0] }] },
  { id: "t2", name: "Azul", color: "#3b82f6", team_members: [{ id: "tm2", profile_id: "p2", profiles: profiles[1] }, { id: "tm3", guest_player_id: "g9", guest_name: "Invitado X" }] },
];

describe("match detail model", () => {
  it("orders the roster by confirmation, adds guests, lists the waitlist with turns", () => {
    const vm = buildMatchDetailModel({ match, attendances, guests: [{ id: "g1", name: "Pepe" }], profile: profiles[0], profileById: byId, teams, now: NOW });
    expect(vm.roster.map((r) => r.name)).toEqual(["Dos", "Yo", "Pepe"]);
    expect(vm.roster.find((r) => r.name === "Dos").checkedIn).toBe(true);
    expect(vm.roster.find((r) => r.name === "Yo").isMe).toBe(true);
    expect(vm.roster.find((r) => r.name === "Pepe").isGuest).toBe(true);
    expect(vm.waitlist).toEqual([expect.objectContaining({ name: "Tres", turn: 1 })]);
    expect(vm.confirmedCount).toBe(3);
    expect(vm.state.key).toBe("confirmed");
  });

  it("normalises teams with goalkeepers first and guest members", () => {
    const vm = buildMatchDetailModel({ match, attendances, profile: profiles[0], profileById: byId, teams, now: NOW });
    expect(vm.teams[1].members.map((m) => [m.name, m.positionShort, m.isGuest])).toEqual([["Dos", "POR", false], ["Invitado X", "INV", true]]);
    expect(vm.teams[0].members[0].isMe).toBe(true);
  });

  it("totals post-match stats", () => {
    const vm = buildMatchDetailModel({
      match: { ...match, status: "closed" }, attendances, profile: profiles[0], profileById: byId, now: NOW,
      matchStats: [{ id: "s1", match_id: "m1", player_id: "me", goals: 2, assists: 1, mvp: true }, { id: "s2", match_id: "m1", player_id: "p2", goals: 1, assists: 0 }],
    });
    expect(vm.isClosed).toBe(true);
    expect(vm.totals).toMatchObject({ goals: 3, assists: 1, mvp: "Yo" });
    expect(vm.totals.scorers.map((s) => s.name)).toEqual(["Yo", "Dos"]);
  });
});

describe("MatchDetail experiences", () => {
  const base = {
    match, attendances, guests: [], profile: { ...profiles[0], is_active: true }, profiles, profileById: byId, ratingMap: new Map(), teams,
    matchStats: [], venues: [], clearance: { clear: true }, isAdmin: true,
    onConfirm: vi.fn(), onCancel: vi.fn(), onJoinWaitlist: vi.fn(), onCheckIn: vi.fn(), onMarkNoShow: vi.fn(), onGenerateTeams: vi.fn(),
    onAddGuest: vi.fn(), onDeleteGuest: vi.fn(), onUpdateGuestRating: vi.fn(), onReconfirm: vi.fn(), onDeleteMatch: vi.fn(), onSaveStats: vi.fn().mockResolvedValue(), onBack: vi.fn(),
  };
  for (const design of ["editorial", "command"]) {
    it(`${design}: shows roster, waitlist and teams; cancel and admin handlers are the real ones`, async () => {
      const onCancel = vi.fn();
      const onGenerateTeams = vi.fn();
      const { container } = render(<MatchDetail {...base} onCancel={onCancel} onGenerateTeams={onGenerateTeams} forceDesign={design} />);
      expect(container.querySelector(`[data-design="${design}"][data-view="match-detail"]`)).not.toBeNull();
      expect(container.querySelector("#convocatoria").textContent).toMatch(/Dos/);
      expect(container.querySelector(".mdd-waitlist").textContent).toMatch(/#1.*Tres/);
      expect(container.querySelectorAll(".mdd-team").length).toBe(2);
      if (design === "command") expect(container.querySelector(".mdd-pitch")).not.toBeNull();
      await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: /Cancelar asistencia/ })[0]); });
      expect(onCancel).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Generar equipos/ }));
      expect(onGenerateTeams).toHaveBeenCalledWith({});
    });

    it(`${design}: the stats modal edits with steppers and saves through onSaveStats`, async () => {
      const onSaveStats = vi.fn().mockResolvedValue();
      render(<MatchDetail {...base} onSaveStats={onSaveStats} forceDesign={design} />);
      fireEvent.click(screen.getByRole("button", { name: /Cargar estadísticas/ }));
      const dialog = screen.getByRole("dialog", { name: /Estadísticas del partido/ });
      fireEvent.click(screen.getAllByRole("button", { name: "Sumar Goles" })[0]);
      fireEvent.click(screen.getAllByRole("button", { name: "Sumar Goles" })[0]);
      expect(dialog.querySelector(".mdd-stats-board b").textContent).toBe("2");
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Guardar estadísticas/ })); });
      expect(onSaveStats).toHaveBeenCalledWith("m1", expect.arrayContaining([expect.objectContaining({ goals: 2 })]));
    });
  }

  it("non-admins do not see administration tools", () => {
    render(<MatchDetail {...base} isAdmin={false} forceDesign="editorial" />);
    expect(screen.queryByText(/Administración del partido/)).toBeNull();
  });
});
