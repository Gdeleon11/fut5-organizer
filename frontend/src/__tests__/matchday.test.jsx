import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  DEFAULT_APPEARANCE,
  STORAGE_KEY,
  LEGACY_THEME_KEY,
  applyAppearance,
  normalizeAppearance,
  pickNewest,
  readLocalAppearance,
  writeLocalAppearance,
} from "../appearance/appearance.js";
import { AppearanceProvider, useAppearance } from "../appearance/AppearanceProvider.jsx";
import AppearanceSettings from "../components/AppearanceSettings.jsx";
import {
  buildMatchdayModel,
  dateParts,
  deriveMatchState,
  pickFeatured,
} from "../matchday/matchdayModel.js";
import { lineupColumns } from "../components/matchday/CommandMatchesView.jsx";
import MatchesPage from "../pages/MatchesPage.jsx";

// Some Node/jsdom combos expose no usable localStorage: install an in-memory one.
if (typeof window.localStorage?.clear !== "function") {
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
  Object.defineProperty(window, "localStorage", { value: store, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
}

const NOW = new Date(2026, 10, 19, 12, 0, 0); // 19 Nov 2026, noon
const TODAY = "2026-11-19";
const match = (over = {}) => ({ id: "m1", title: "Plaza 1", venue: "Plaza 1", match_date: TODAY, start_time: "19:00", max_players: 15, status: "upcoming", ...over });
const me = { id: "me", nickname: "Yo", is_active: true };

describe("appearance preferences", () => {
  beforeEach(() => localStorage.clear());

  it("normalizes unknown values to defaults", () => {
    expect(normalizeAppearance({ design: "x", palette: "y" })).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({ design: "command", palette: "gold", updatedAt: 5 })).toEqual({ design: "command", palette: "gold", updatedAt: 5 });
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
  });

  it("persists locally and migrates the legacy ThemeSwitcher value", () => {
    localStorage.setItem(LEGACY_THEME_KEY, "night");
    expect(readLocalAppearance().palette).toBe("midnight");
    writeLocalAppearance({ design: "command", palette: "light", updatedAt: 10 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({ design: "command", palette: "light", updatedAt: 10 });
    expect(readLocalAppearance()).toEqual({ design: "command", palette: "light", updatedAt: 10 });
  });

  it("survives corrupted storage", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readLocalAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it("newest value wins between devices", () => {
    expect(pickNewest({ design: "editorial", palette: "neon", updatedAt: 1 }, { design: "command", palette: "gold", updatedAt: 2 }).design).toBe("command");
    expect(pickNewest({ design: "editorial", palette: "neon", updatedAt: 3 }, { design: "command", palette: "gold", updatedAt: 2 }).design).toBe("editorial");
  });

  it("applies and cleans up root attributes", () => {
    const el = document.createElement("html");
    el.setAttribute("data-theme", "night");
    const cleanup = applyAppearance({ design: "command", palette: "light" }, el);
    expect(el.getAttribute("data-f5-design")).toBe("command");
    expect(el.getAttribute("data-f5-palette")).toBe("light");
    expect(el.style.colorScheme).toBe("light");
    expect(el.hasAttribute("data-theme")).toBe(false);
    cleanup();
    expect(el.hasAttribute("data-f5-palette")).toBe(false);
  });

  it("selector changes design/palette instantly, persists, and syncs to the signed-in user", async () => {
    vi.useFakeTimers();
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const client = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: "u1", user_metadata: {} } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        updateUser,
      },
    };
    function Probe() {
      const { design, palette } = useAppearance();
      return <output data-testid="probe">{`${design}/${palette}`}</output>;
    }
    render(
      <AppearanceProvider client={client}>
        <Probe />
        <AppearanceSettings />
      </AppearanceProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByLabelText(/Sports Command Center/));
    fireEvent.click(screen.getByLabelText(/Elite Gold/));
    expect(screen.getByTestId("probe").textContent).toBe("command/gold");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toMatchObject({ design: "command", palette: "gold" });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser.mock.calls[0][0].data.f5_appearance).toMatchObject({ design: "command", palette: "gold" });
    vi.useRealTimers();
  });

  it("adopts a newer preference saved from another device", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ design: "editorial", palette: "neon", updatedAt: 1 }));
    const client = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: "u1", user_metadata: { f5_appearance: { design: "command", palette: "midnight", updatedAt: 99 } } } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        updateUser: vi.fn(),
      },
    };
    function Probe() {
      const { design, palette } = useAppearance();
      return <output data-testid="probe">{`${design}/${palette}`}</output>;
    }
    render(<AppearanceProvider client={client}><Probe /></AppearanceProvider>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByTestId("probe").textContent).toBe("command/midnight");
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("matchday state rules", () => {
  it("covers the seven visible states", () => {
    const m = match();
    expect(deriveMatchState({ match: m, attendance: { status: "confirmed" }, confirmedCount: 7, profile: me, now: NOW }).key).toBe("confirmed");
    expect(deriveMatchState({ match: m, confirmedCount: 7, profile: me, now: NOW }).key).toBe("available");
    expect(deriveMatchState({ match: m, attendance: { status: "waitlist" }, waitlistPos: 2, confirmedCount: 15, profile: me, now: NOW }).status).toMatch(/#2/);
    expect(deriveMatchState({ match: m, confirmedCount: 15, profile: me, now: NOW }).key).toBe("full");
    expect(deriveMatchState({ match: match({ status: "canceled" }), now: NOW }).key).toBe("cancelled");
    expect(deriveMatchState({ match: match({ status: "closed" }), confirmedCount: 10, now: NOW }).key).toBe("finished");
    expect(deriveMatchState({ match: null }).key).toBe("empty");
  });

  it("maps actions to the existing handlers", () => {
    const m = match();
    expect(deriveMatchState({ match: m, confirmedCount: 3, profile: me, now: NOW }).primary.kind).toBe("confirm");
    expect(deriveMatchState({ match: m, confirmedCount: 15, profile: me, now: NOW }).primary.kind).toBe("waitlist");
    expect(deriveMatchState({ match: m, attendance: { status: "confirmed" }, now: NOW }).secondary.kind).toBe("cancel");
    expect(deriveMatchState({ match: m, attendance: { status: "checked_in" }, now: NOW }).secondary).toBeNull();
  });

  it("keeps AttendanceAction gating (inactive, clearance) and late-cancel fine label", () => {
    const m = match();
    const inactive = deriveMatchState({ match: m, confirmedCount: 3, profile: { ...me, is_active: false }, now: NOW });
    expect(inactive.primary.disabled).toBe(true);
    const debt = deriveMatchState({ match: m, confirmedCount: 3, profile: me, clearance: { clear: false }, now: NOW });
    expect(debt.primary).toMatchObject({ disabled: true, label: "Sin finiquito" });
    const late = deriveMatchState({ match: match({ start_time: "13:00" }), attendance: { status: "confirmed" }, fineAmount: 25, now: NOW });
    expect(late.secondary.label).toMatch(/multa Q25/);
  });

  it("builds date parts and relative tags", () => {
    expect(dateParts(match(), NOW)).toMatchObject({ day: "19", dow: "JUE", mon: "NOV", time: "19:00", whenTag: "HOY" });
    expect(dateParts(match({ match_date: "2026-11-20" }), NOW).whenTag).toBe("MAÑANA");
  });

  it("features today's finished/cancelled match when nothing is upcoming", () => {
    const done = match({ status: "closed" });
    expect(pickFeatured({ nextMatch: null, pastMatches: [done], now: NOW })).toBe(done);
    expect(pickFeatured({ nextMatch: null, pastMatches: [match({ match_date: "2026-11-01", status: "closed" })], now: NOW })).toBeNull();
  });

  it("counts guests and marks the current player in the roster", () => {
    const model = buildMatchdayModel({
      nextMatch: match(),
      upcoming: [match()],
      attendances: [
        { match_id: "m1", profile_id: "me", status: "confirmed" },
        { match_id: "m1", profile_id: "p2", status: "confirmed" },
        { match_id: "m1", profile_id: "p3", status: "canceled" },
      ],
      profiles: [me, { id: "p2", nickname: "Dos" }],
      guests: { m1: [{ id: "g1", name: "Invitado" }] },
      profile: me,
      now: NOW,
    });
    expect(model.featured.confirmedCount).toBe(3);
    expect(model.featured.roster.map((r) => [r.name, r.isMe, r.isGuest])).toEqual([["Yo", true, false], ["Dos", false, false], ["Invitado", false, true]]);
  });

  it("splits pitch tokens into columns", () => {
    expect(lineupColumns(15)).toEqual([3, 4, 4, 4]);
    expect(lineupColumns(18).reduce((a, b) => a + b, 0)).toBe(18);
  });
});

describe("MatchesPage experiences", () => {
  const base = {
    matches: [match()],
    pastMatches: [],
    nextMatch: match(),
    attendances: [{ match_id: "m1", profile_id: "p2", status: "confirmed" }],
    profiles: [me, { id: "p2", nickname: "Dos" }],
    profile: me,
    clearance: { clear: true },
    onOpenMatch: () => {},
    onCreateMatch: async () => {},
    onDeleteMatch: async () => {},
    now: NOW,
  };

  for (const design of ["editorial", "command"]) {
    it(`${design}: confirm calls the real handler with the match`, async () => {
      const onConfirm = vi.fn().mockResolvedValue();
      const { container } = render(<MatchesPage {...base} forceDesign={design} onConfirm={onConfirm} />);
      expect(container.querySelector(`[data-design="${design}"]`)).not.toBeNull();
      expect(container.querySelector('[data-match-state="available"]')).not.toBeNull();
      const btn = screen.getAllByRole("button", { name: "Confirmar asistencia" })[0];
      await act(async () => { fireEvent.click(btn); });
      expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }));
    });

    it(`${design}: shows the empty state without inventing data`, () => {
      const { container } = render(<MatchesPage {...base} forceDesign={design} matches={[]} nextMatch={null} />);
      expect(container.querySelector('[data-match-state="empty"]')).not.toBeNull();
      expect(screen.queryByText("Plaza 1")).toBeNull();
    });
  }

  it("hides admin tools for players", () => {
    render(<MatchesPage {...base} forceDesign="editorial" isAdmin={false} />);
    expect(screen.queryByText(/Nuevo partido/)).toBeNull();
  });
});
