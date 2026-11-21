import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import fs from "fs";
import path from "path";

const rpc = vi.fn();
vi.mock("../supabaseClient.js", () => ({ supabase: { rpc: (...a) => rpc(...a) }, hasSupabaseConfig: true }));

import { api } from "../api.js";
import {
  canCancelSpot, dateWindow, fillTeamProfiles, isLateCancel, matchStartsAt, notificationTarget, publishBlockers,
  radarProfiles, roundCoords, splitMyRequests, validatePublishForm,
} from "../radar/radarModel.js";
import RadarPage from "../pages/RadarPage.jsx";
import RadarAdminPanel from "../components/radar/RadarAdminPanel.jsx";
import NotificationBell from "../components/radar/NotificationBell.jsx";
import RadarSettingsCard from "../components/radar/RadarSettingsCard.jsx";

const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const listing = (over = {}) => ({
  listing_id: "L1", match_date: future(2), start_time: "19:00", starts_at: new Date(Date.now() + 2 * 86400000).toISOString(),
  venue_name: "Domo Zona 10", zone_label: "Zona 10", distance_bucket: "<2 km", max_players: 12, occupancy: 9,
  radar_slots_left: 2, level_band: "intermedio", positions: ["Goalkeeper"], note: "Falta portero", cost_hint: 35,
  organizer_label: "Grupo privado", my_request_status: null, listing_status: "open", ...over,
});

function fakeRadarApi(over = {}) {
  return {
    radarNearby: vi.fn().mockResolvedValue([listing()]),
    radarZones: vi.fn().mockResolvedValue([{ zone_label: "Zona 10", listings: 1 }]),
    radarListingCard: vi.fn().mockResolvedValue({ ...listing(), rules: { late_cancel_hours: 4, late_cancel_fine_amount: 30 }, my_request: null, private: null }),
    radarRequestSpot: vi.fn().mockResolvedValue({ request_id: "R1", status: "pending" }),
    radarWithdrawRequest: vi.fn().mockResolvedValue({ status: "withdrawn" }),
    radarCancelSpot: vi.fn().mockResolvedValue({ status: "canceled" }),
    radarMyRequests: vi.fn().mockResolvedValue([]),
    radarMatchPeople: vi.fn().mockResolvedValue([]),
    getRadarGroupSettings: vi.fn().mockResolvedValue({ enabled: true, show_group_name: false }),
    setRadarGroupSettings: vi.fn().mockImplementation(async (_g, enabled, show) => ({ enabled, show_group_name: show })),
    getRadarListingForMatch: vi.fn().mockResolvedValue(null),
    radarAdminRequests: vi.fn().mockResolvedValue([]),
    publishRadarMatch: vi.fn().mockResolvedValue({ id: "L9", status: "open" }),
    setRadarListingStatus: vi.fn().mockResolvedValue({}),
    radarDecideRequest: vi.fn().mockResolvedValue({ status: "approved", match_id: "m1", confirmed_profile_ids: ["a", "x"] }),
    radarBanRequester: vi.fn().mockResolvedValue({ banned: true }),
    radarGroupBans: vi.fn().mockResolvedValue([]),
    radarUnban: vi.fn().mockResolvedValue({}),
    listNotifications: vi.fn().mockResolvedValue([]),
    countUnreadNotifications: vi.fn().mockResolvedValue(0),
    markNotificationsRead: vi.fn().mockResolvedValue(1),
    ...over,
  };
}

beforeEach(() => { rpc.mockReset(); });

describe("radar model", () => {
  it("reads match times in America/Guatemala and applies the 4 h late-cancel window", () => {
    expect(matchStartsAt("2026-11-22", "19:00").toISOString()).toBe("2026-11-23T01:00:00.000Z");
    const start = new Date("2026-11-23T01:00:00Z");
    expect(isLateCancel(start, new Date("2026-11-22T21:30:00Z"))).toBe(true);
    expect(isLateCancel(start, new Date("2026-11-22T20:59:00Z"))).toBe(false);
  });

  it("rounds coordinates to ≈1 km and builds date windows", () => {
    expect(roundCoords(14.63491, -90.50694)).toEqual({ lat: 14.63, lng: -90.51 });
    expect(roundCoords(null, 1)).toBeNull();
    const w = dateWindow("week", new Date("2026-11-21T12:00:00Z"));
    expect(w).toEqual({ from: "2026-11-21", to: "2026-11-28" });
  });

  it("splits requests and only lets approved, future spots be canceled", () => {
    const past = { status: "approved", listing: { starts_at: new Date(Date.now() - 3600000).toISOString() } };
    const next = { status: "approved", listing: { starts_at: new Date(Date.now() + 3600000).toISOString() } };
    const rej = { status: "rejected", listing: next.listing };
    const { active, history } = splitMyRequests([past, next, rej]);
    expect(active).toEqual([next]);
    expect(history).toEqual([past, rej]);
    expect(canCancelSpot(next)).toBe(true);
    expect(canCancelSpot(past)).toBe(false);
  });

  it("validates the publish form and explains blockers like the server", () => {
    expect(validatePublishForm({ radarSlots: 0 })).toMatch(/al menos 1/);
    expect(validatePublishForm({ radarSlots: 4, freeSlots: 3 })).toMatch(/Solo quedan 3/);
    expect(validatePublishForm({ radarSlots: 2, freeSlots: 3, zoneLabel: "Z" })).toMatch(/zona/);
    expect(validatePublishForm({ radarSlots: 2, freeSlots: 3, zoneLabel: "Zona 10" })).toBeNull();
    const match = { status: "upcoming", match_date: future(3), start_time: "19:00", allowed_tags: ["residente"] };
    const b = publishBlockers({ match, venue: { lat: null, lng: null }, radarEnabled: false });
    expect(b.join(" ")).toMatch(/desactivado/);
    expect(b.join(" ")).toMatch(/tags/);
    expect(b.join(" ")).toMatch(/ubicación/);
    expect(publishBlockers({ match: { ...match, allowed_tags: [] }, venue: { lat: 1, lng: 2 }, radarEnabled: true })).toEqual([]);
  });

  it("Radar players get a nickname-only profile and fill hidden team members", () => {
    const list = radarProfiles([{ profile_id: "x", nickname: "Gato" }, { profile_id: "a", nickname: "Ya miembro" }], [{ id: "a" }]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "x", nickname: "Gato · Radar", full_name: null, phone: null, is_radar: true, membership_is_active: true });
    const teams = fillTeamProfiles({ m1: [{ team_members: [{ profile_id: "x", profiles: null }, { profile_id: "a", profiles: { id: "a" } }] }] }, list);
    expect(teams.m1[0].team_members[0].profiles.nickname).toBe("Gato · Radar");
    expect(teams.m1[0].team_members[1].profiles).toEqual({ id: "a" });
  });

  it("routes notifications to the admin's match or the player's requests", () => {
    expect(notificationTarget({ kind: "radar_request_received", match_id: "m1" })).toEqual({ page: "match", matchId: "m1" });
    expect(notificationTarget({ kind: "radar_request_approved" })).toEqual({ page: "radar", tab: "mine" });
  });
});

describe("radar api layer", () => {
  it("rounds coordinates on the device before calling radar_nearby", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await api.radarNearby({ lat: 14.634912, lng: -90.506941, radiusKm: 15, zone: "" });
    expect(rpc).toHaveBeenCalledWith("radar_nearby", expect.objectContaining({ p_lat: 14.63, p_lng: -90.51, p_radius_km: 15, p_zone: null }));
  });

  it("uses only the Radar RPCs for requests and decisions", async () => {
    rpc.mockResolvedValue({ data: { status: "pending" }, error: null });
    await api.radarRequestSpot("L1", "Goalkeeper", "hola");
    expect(rpc).toHaveBeenLastCalledWith("radar_request_spot", { p_listing_id: "L1", p_position: "Goalkeeper", p_message: "hola" });
    await api.radarDecideRequest("R1", false, "");
    expect(rpc).toHaveBeenLastCalledWith("radar_decide_request", { p_request_id: "R1", p_approve: false, p_note: null });
  });

  it("surfaces server errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Ya no quedan cupos de Radar en este partido." } });
    await expect(api.radarRequestSpot("L1")).rejects.toThrow(/cupos de Radar/);
  });
});

describe("Radar page", () => {
  it("lists nearby matches without exact location and requests a spot", async () => {
    const r = fakeRadarApi();
    render(<RadarPage radarApi={r} />);
    const item = await screen.findByRole("button", { name: /Ver partido del .* en Domo Zona 10/ });
    expect(item.textContent).toMatch(/Zona 10 · <2 km/);
    expect(item.textContent).toMatch(/2 cupos Radar/);
    fireEvent.click(item);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/multa de Q30/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Posición/), { target: { value: "Goalkeeper" } });
    fireEvent.change(within(dialog).getByLabelText(/Mensaje para el organizador/), { target: { value: "Atajo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Solicitar cupo/ }));
    await waitFor(() => expect(r.radarRequestSpot).toHaveBeenCalledWith("L1", "Goalkeeper", "Atajo"));
  });

  it("asks for location only on tap and sends rounded coordinates", async () => {
    const r = fakeRadarApi();
    const getCurrentPosition = vi.fn((ok) => ok({ coords: { latitude: 14.634912, longitude: -90.506941 } }));
    Object.defineProperty(global.navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    render(<RadarPage radarApi={r} />);
    await screen.findByText("Domo Zona 10");
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Usar mi ubicación/ }));
    await waitFor(() => expect(r.radarNearby).toHaveBeenLastCalledWith(expect.objectContaining({ lat: 14.63, lng: -90.51, zone: null })));
    expect(screen.getByText(/No se guarda/)).toBeTruthy();
  });

  it("shows the address only for approved requests and confirms a late cancel", async () => {
    const soon = new Date(Date.now() + 2 * 3600000).toISOString();
    const r = fakeRadarApi({
      radarMyRequests: vi.fn().mockResolvedValue([
        { id: "A", status: "approved", listing: listing({ starts_at: soon }), private: { venue_address: "Calle 7-40", per_player_amount: 30, payment_status: "pending" }, fine: null },
        { id: "P", status: "pending", listing: listing({ listing_id: "L2", venue_name: "Cancha B" }), private: null, fine: null },
      ]),
    });
    render(<RadarPage radarApi={r} initialTab="mine" />);
    expect(await screen.findByText(/Calle 7-40/)).toBeTruthy();
    expect(screen.getAllByText(/Calle 7-40/)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Cancelar mi cupo/ }));
    expect(screen.getByText(/menos de 4 horas: se generará una multa/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sí, cancelar/ }));
    await waitFor(() => expect(r.radarCancelSpot).toHaveBeenCalledWith("A"));
  });

  it("shows server errors in an alert", async () => {
    const r = fakeRadarApi({ radarNearby: vi.fn().mockRejectedValue(new Error("Iniciá sesión para ver Radar.")) });
    render(<RadarPage radarApi={r} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Iniciá sesión/);
  });
});

describe("Radar admin panel", () => {
  const match = { id: "m1", status: "upcoming", match_date: future(3), start_time: "19:00", max_players: 10, allowed_tags: [] };
  const venue = { id: "v1", name: "Cancha QA", lat: 14.6, lng: -90.5 };

  it("explains why a match cannot be published", async () => {
    const r = fakeRadarApi({ getRadarGroupSettings: vi.fn().mockResolvedValue({ enabled: false }) });
    render(<RadarAdminPanel match={match} venue={{ ...venue, lat: null }} groupId="g1" occupancy={4} radarApi={r} />);
    expect(await screen.findByText(/Radar está desactivado/)).toBeTruthy();
    expect(screen.getByText(/sede con ubicación/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Publicar en Radar/ })).toBeNull();
  });

  it("publishes with the chosen slots, level and positions", async () => {
    const r = fakeRadarApi();
    render(<RadarAdminPanel match={match} venue={venue} groupId="g1" occupancy={4} radarApi={r} />);
    fireEvent.click(await screen.findByRole("button", { name: /Publicar en Radar/ }));
    fireEvent.change(screen.getByLabelText(/Cupos para Radar/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/^Nivel/), { target: { value: "casual" } });
    fireEvent.click(screen.getByLabelText(/Portero/));
    fireEvent.change(screen.getByLabelText(/Zona visible/), { target: { value: "Zona 15" } });
    fireEvent.click(screen.getByRole("button", { name: /^Publicar$/ }));
    await waitFor(() => expect(r.publishRadarMatch).toHaveBeenCalledWith("m1", expect.objectContaining({ radarSlots: "2", levelBand: "casual", positions: ["Goalkeeper"], zoneLabel: "Zona 15" })));
  });

  it("refuses more Radar slots than free slots before calling the server", async () => {
    const r = fakeRadarApi();
    render(<RadarAdminPanel match={match} venue={venue} groupId="g1" occupancy={9} radarApi={r} />);
    fireEvent.click(await screen.findByRole("button", { name: /Publicar en Radar/ }));
    fireEvent.change(screen.getByLabelText(/Cupos para Radar/), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /^Publicar$/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Solo quedan 1/);
    expect(r.publishRadarMatch).not.toHaveBeenCalled();
  });

  it("approves and rejects requests from the inbox", async () => {
    const onApproved = vi.fn();
    const r = fakeRadarApi({
      getRadarListingForMatch: vi.fn().mockResolvedValue({ id: "L1", status: "open", radar_slots: 2, level_band: "any", positions: [], zone_label: "Zona 15" }),
      radarAdminRequests: vi.fn().mockResolvedValue([
        { request_id: "R1", nickname: "Gato", position: "Goalkeeper", message: "Atajo", status: "pending", created_at: new Date().toISOString() },
        { request_id: "R2", nickname: "Pibe", position: "Forward", status: "pending", created_at: new Date().toISOString() },
      ]),
    });
    render(<RadarAdminPanel match={match} venue={venue} groupId="g1" occupancy={4} radarApi={r} onApproved={onApproved} />);
    fireEvent.click(await screen.findByRole("button", { name: "Aceptar a Gato" }));
    await waitFor(() => expect(r.radarDecideRequest).toHaveBeenCalledWith("R1", true, null));
    await waitFor(() => expect(onApproved).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" })));
    fireEvent.click(screen.getByRole("button", { name: "Rechazar a Pibe" }));
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: "Ya completamos" } });
    fireEvent.click(screen.getByRole("button", { name: /^Rechazar$/ }));
    await waitFor(() => expect(r.radarDecideRequest).toHaveBeenCalledWith("R2", false, "Ya completamos"));
  });

  it("disables Accept when the match is full", async () => {
    const r = fakeRadarApi({
      getRadarListingForMatch: vi.fn().mockResolvedValue({ id: "L1", status: "open", radar_slots: 2, level_band: "any", positions: [], zone_label: "Z" }),
      radarAdminRequests: vi.fn().mockResolvedValue([{ request_id: "R1", nickname: "Gato", status: "pending", created_at: new Date().toISOString() }]),
    });
    render(<RadarAdminPanel match={match} venue={venue} groupId="g1" occupancy={10} radarApi={r} />);
    expect((await screen.findByRole("button", { name: "Aceptar a Gato" })).disabled).toBe(true);
    expect(screen.getByText(/El partido está lleno/)).toBeTruthy();
  });
});

describe("Notifications and settings", () => {
  it("shows unread count, marks read on open and navigates", async () => {
    const onNavigate = vi.fn();
    const r = fakeRadarApi({
      countUnreadNotifications: vi.fn().mockResolvedValue(2),
      listNotifications: vi.fn().mockResolvedValue([{ id: "n1", kind: "radar_request_received", match_id: "m1", title: "Nueva solicitud en Radar", body: "Gato pidió un cupo", created_at: new Date().toISOString(), read_at: null }]),
    });
    render(<NotificationBell radarApi={r} onNavigate={onNavigate} />);
    const btn = await screen.findByRole("button", { name: "Notificaciones: 2 sin leer" });
    fireEvent.click(btn);
    fireEvent.click(await screen.findByText("Nueva solicitud en Radar"));
    await waitFor(() => expect(r.markNotificationsRead).toHaveBeenCalledWith(["n1"]));
    expect(onNavigate).toHaveBeenCalledWith({ page: "match", matchId: "m1" });
  });

  it("super admin switches Radar on for the group", async () => {
    const r = fakeRadarApi({ getRadarGroupSettings: vi.fn().mockResolvedValue({ enabled: false, show_group_name: false }) });
    render(<RadarSettingsCard groupId="g1" radarApi={r} />);
    fireEvent.click(await screen.findByLabelText(/Permitir publicar partidos en Radar/));
    await waitFor(() => expect(r.setRadarGroupSettings).toHaveBeenCalledWith("g1", true, false));
    expect(await screen.findByText(/Radar activado/)).toBeTruthy();
  });
});

describe("Radar migration (static checks)", () => {
  const sql = fs.readFileSync(path.resolve(__dirname, "../../../supabase/migrations/20261121180000_radar_mvp.sql"), "utf8");

  it("is additive: no DROP TABLE/COLUMN and no change to existing policies", () => {
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/DROP\s+COLUMN/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+public\.(matches|attendances|profiles|fines|groups|group_members|venues|settings)\b(?!.*ENABLE)/i);
    const dropped = [...sql.matchAll(/DROP POLICY IF EXISTS (\w+) ON public\.(\w+)/g)].map((m) => m[2]);
    expect(dropped.every((t) => t.startsWith("radar_") || t === "app_notifications")).toBe(true);
  });

  it("enables RLS on every new table and grants nothing to anon", () => {
    for (const t of ["radar_group_settings", "radar_listings", "radar_requests", "radar_match_access", "radar_group_bans", "app_notifications"]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`));
    }
    expect(sql).not.toMatch(/GRANT[^;]*TO\s+anon/i);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it("never returns match ids or coordinates from discovery", () => {
    const nearby = sql.slice(sql.indexOf("FUNCTION public.radar_nearby"), sql.indexOf("FUNCTION public.radar_zones"));
    const returns = nearby.slice(nearby.indexOf("RETURNS TABLE"), nearby.indexOf("LANGUAGE"));
    expect(returns).not.toMatch(/\bmatch_id\b|\bgroup_id\b|\blat\b|\blng\b|address/);
  });
});
