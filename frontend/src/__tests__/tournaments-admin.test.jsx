import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

vi.mock("../api.js", () => ({
  api: {
    listTournaments: vi.fn(), listTournamentTeams: vi.fn(), listTournamentMatches: vi.fn(), listStandings: vi.fn(),
    listAllTournamentTeamMembers: vi.fn(), updateTournamentMatch: vi.fn(), updateStanding: vi.fn(),
    getPublicReservationsByTokens: vi.fn(), uploadReservationProof: vi.fn(), submitReservationProofByToken: vi.fn(),
    verifyProofToken: vi.fn(), uploadPaymentProof: vi.fn(),
  },
}));

import { api } from "../api.js";
import { generateFixtures, updateStandings } from "../tournamentEngine.js";
import { bracketColumns, formGuide, groupRounds, matchWinner, teamRating } from "../tournament/tournamentModel.js";
import { CAPABILITIES, canRole } from "../admin/permissions.js";
import TournamentPage from "../pages/TournamentPage.jsx";
import GroupsPage from "../pages/GroupsPage.jsx";
import ReservePage from "../pages/ReservePage.jsx";
import ProofUploadPage from "../pages/ProofUploadPage.jsx";

const teams = ["A", "B", "C", "D"].map((n, i) => ({ id: `t${i}`, name: `Equipo ${n}`, team_order: i + 1 }));

describe("tournament presentation model (engine untouched)", () => {
  it("groups the engine fixtures by round and finds the playoff bracket", () => {
    const fx = generateFixtures("league_playoffs", teams, "2026-10-05", "monday", "19:00", "Cancha").map((f, i) => ({ ...f, id: `m${i}` }));
    const rounds = groupRounds(fx);
    expect(rounds.map((r) => r.round)).toEqual([1, 2, 3, 4, 5]);
    expect(rounds.filter((r) => r.playoff)).toHaveLength(2);
    expect(bracketColumns(fx).map((c) => c.title)).toEqual(["Semifinales", "Final"]);
    expect(bracketColumns(generateFixtures("league", teams, "2026-10-05", "monday", "19:00", ""))).toEqual([]);
    const cup = generateFixtures("playoffs_only", teams, "2026-10-05", "monday", "19:00", "").map((f, i) => ({ ...f, id: `c${i}` }));
    expect(bracketColumns(cup).map((c) => c.title)).toEqual(["Semifinales", "Final"]);
  });

  it("winner, form guide and team rating are display-only reads", () => {
    const played = [
      { id: "1", round: 1, home_team_id: "t0", away_team_id: "t1", status: "played", home_score: 2, away_score: 1 },
      { id: "2", round: 2, home_team_id: "t2", away_team_id: "t0", status: "played", home_score: 1, away_score: 1 },
      { id: "3", round: 3, home_team_id: "t0", away_team_id: "t3", status: "scheduled" },
    ];
    expect(matchWinner(played[0])).toBe("t0");
    expect(matchWinner(played[1])).toBeNull();
    expect(formGuide(played, "t0")).toEqual(["G", "E"]);
    expect(teamRating(["a", "b", "c"], new Map([["a", { rating: 5 }]]))).toBe(9); // missing ratings count as 2
  });
});

describe("TournamentPage keeps the same writes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only the super admin can manage tournaments", () => {
    api.listTournaments.mockResolvedValue([]);
    render(<TournamentPage activeGroupId="g" profiles={[]} ratingMap={new Map()} isAdmin isSuperAdmin={false} />);
    expect(screen.getByText("Solo el Super Admin puede gestionar torneos.")).toBeTruthy();
  });

  it("recording a result updates the match and the standings with tournamentEngine values", async () => {
    const t = { id: "T1", name: "Liga QA", format: "league", status: "active", start_date: "2026-10-05" };
    const matches = [{ id: "M1", round: 1, match_order: 1, home_team_id: "t0", away_team_id: "t1", status: "scheduled", match_date: "2026-10-05" }];
    const standings = teams.slice(0, 2).map((tm, i) => ({ id: `S${i}`, tournament_team_id: tm.id, tournament_team: tm, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }));
    api.listTournaments.mockResolvedValue([t]);
    api.listTournamentTeams.mockResolvedValue(teams.slice(0, 2));
    api.listTournamentMatches.mockResolvedValue(matches);
    api.listStandings.mockResolvedValue(standings);
    api.listAllTournamentTeamMembers.mockResolvedValue([]);
    api.updateTournamentMatch.mockResolvedValue({});
    api.updateStanding.mockResolvedValue({});

    render(<TournamentPage activeGroupId="g" profiles={[]} ratingMap={new Map()} isAdmin isSuperAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: /Liga QA/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Resultado" }));
    fireEvent.change(screen.getByLabelText("Goles local"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Goles visitante"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() => expect(api.updateStanding).toHaveBeenCalledTimes(2));
    expect(api.updateTournamentMatch).toHaveBeenCalledWith("M1", { home_score: 3, away_score: 1, status: "played" });
    // Values from tournamentEngine.updateStandings on a fresh table (the page mutates its rows, so compute on clean copies).
    const fresh = teams.slice(0, 2).map((tm, i) => ({ id: `S${i}`, tournament_team_id: tm.id, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }));
    const [e0, e1] = updateStandings(fresh, "t0", "t1", 3, 1);
    const pick = ({ played, won, drawn, lost, goals_for, goals_against, points }) => ({ played, won, drawn, lost, goals_for, goals_against, points });
    expect(api.updateStanding).toHaveBeenCalledWith("S0", pick(e0));
    expect(api.updateStanding).toHaveBeenCalledWith("S1", pick(e1));
    expect(pick(e1)).toEqual({ played: 1, won: 0, drawn: 0, lost: 1, goals_for: 1, goals_against: 3, points: 0 });
  });
});

describe("Groups and roles", () => {
  it("permission matrix is cumulative and the super admin sees every capability", () => {
    expect(canRole("super_admin", "admin")).toBe(true);
    expect(canRole("player", "admin")).toBe(false);
    expect(CAPABILITIES.every(([, , min]) => canRole("super_admin", min))).toBe(true);
  });

  it("description editing and group creation call the existing handlers", async () => {
    const onUpdateDescription = vi.fn().mockResolvedValue();
    const onCreateGroup = vi.fn().mockResolvedValue();
    const memberships = [{ group_id: "g", role: "admin", is_active: true, groups: { id: "g", name: "Chamusca QA", description: "" } }];
    render(<GroupsPage activeGroupId="g" memberships={memberships} isAdmin onCreateGroup={onCreateGroup} onSwitchGroup={vi.fn()} onUpdateDescription={onUpdateDescription} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar descripción" }));
    fireEvent.change(screen.getByLabelText(/Descripción, reglas/), { target: { value: "Miércoles 7 PM" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onUpdateDescription).toHaveBeenCalledWith("Miércoles 7 PM"));
    fireEvent.change(screen.getByLabelText("Nombre del grupo"), { target: { value: "  Nueva  " } });
    fireEvent.click(screen.getByRole("button", { name: "Crear grupo" }));
    await waitFor(() => expect(onCreateGroup).toHaveBeenCalledWith("Nueva"));
    fireEvent.click(screen.getByRole("button", { name: /Roles y permisos/ }));
    expect(screen.getByRole("table", { name: /Qué puede hacer cada rol/ })).toBeTruthy();
  });

  it("players do not get the invitation or description editor", () => {
    const memberships = [{ group_id: "g", role: "player", is_active: true, groups: { id: "g", name: "Chamusca QA", description: "Reglas" } }];
    render(<GroupsPage activeGroupId="g" memberships={memberships} isAdmin={false} onCreateGroup={vi.fn()} onSwitchGroup={vi.fn()} onUpdateDescription={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Editar descripción/ })).toBeNull();
    expect(screen.queryByText("Invitación del grupo")).toBeNull();
  });
});

describe("Public pages keep their authorization and upload flows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reservation link: same RPC lookup and upload calls", async () => {
    api.getPublicReservationsByTokens.mockResolvedValue([{ id: "r-1", venue: "Domo", reservation_date: "2026-11-26", reservation_time: "20:00", assigned_display_name: "Ana" }]);
    api.uploadReservationProof.mockResolvedValue("https://x/proof.png");
    api.submitReservationProofByToken.mockResolvedValue({});
    const { container } = render(<ReservePage token="r1" />);
    expect(await screen.findByRole("heading", { name: "Domo" })).toBeTruthy();
    expect(api.getPublicReservationsByTokens).toHaveBeenCalledWith(["r1"]);
    const file = new File(["x"], "p.png", { type: "image/png" });
    fireEvent.change(container.querySelector("input[type=file]"), { target: { files: [file] } });
    await waitFor(() => expect(api.submitReservationProofByToken).toHaveBeenCalledWith("r-1", "https://x/proof.png"));
    expect(api.uploadReservationProof).toHaveBeenCalledWith("r-1", file);
  });

  it("proof link: still blocks someone else's payment and requires a session", async () => {
    api.verifyProofToken.mockResolvedValue({ valid: true, profile_id: "owner", title: "Cuota", amount: 30, proof_status: "pending", payment_id: "p", payment_type: "match_fee" });
    const { unmount } = render(<ProofUploadPage token="tok" session={{ user: { id: "intruder" } }} />);
    expect(await screen.findAllByText("Este comprobante no te pertenece.")).toBeTruthy();
    expect(document.querySelector("input[type=file]")).toBeNull();
    unmount();
    render(<ProofUploadPage token="tok" session={null} />);
    expect(await screen.findByText(/necesitás iniciar sesión primero/)).toBeTruthy();
  });

  it("proof link: owner sees amount, status and can upload", async () => {
    api.verifyProofToken.mockResolvedValue({ valid: true, profile_id: "owner", title: "Cuota cancha", amount: 30, proof_status: "pending", payment_id: "p", payment_type: "match_fee" });
    render(<ProofUploadPage token="tok" session={{ user: { id: "owner" } }} />);
    expect(await screen.findByText("Cuota cancha")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Enviar comprobante" });
    expect(btn.disabled).toBe(true); // until a file is chosen
    const status = screen.getByText("Pendiente");
    expect(within(status.parentElement).getByText("Pendiente")).toBeTruthy();
  });
});
