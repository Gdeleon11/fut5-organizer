import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  treasurySummary, treasuryLedger, myPendingDebts, summarizeCollections, visibleFinesFor, fineTotals,
  venueHistory, splitReservations, assistedReservationsFor, paymentStateLabel, monthCalendar, visibleLimit,
} from "../finance/financeModel.js";
import { Money } from "../components/finance/FinanceBlocks.jsx";
import FeesPage from "../pages/FeesPage.jsx";
import FinesPage from "../pages/FinesPage.jsx";
import CourtReservationPage from "../pages/CourtReservationPage.jsx";

/* ------------------------------------------------------------------
 * Reference implementations: verbatim copies of the calculations that lived
 * inline in TreasuryPage / FeesPage / FinesPage before Entrega 3 (commit bf68240).
 * The new model must produce exactly the same numbers and orderings.
 * ------------------------------------------------------------------ */
const REF = {
  treasury({ fines, matchFees, collections, expenses, matches }) {
    const finesIncome = fines.filter((f) => f.status === "paid").reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const matchFeesIncome = matchFees.reduce((sum, fee) => sum + (fee.match_fee_payments || []).filter((p) => p.status === "paid").length * Number(fee.per_player_amount || 0), 0);
    const collectionsIncome = (collections || []).reduce((sum, col) => sum + (col.collection_payments || []).filter((p) => p.status === "paid").length * Number(col.amount_per_player || 0), 0);
    const totalIncome = finesIncome + matchFeesIncome + collectionsIncome;
    const pendingFees = (matchFees || []).reduce((sum, fee) => sum + (fee.match_fee_payments || []).filter((p) => p.status === "pending").length * Number(fee.per_player_amount || 0), 0);
    const pendingCollections = (collections || []).reduce((sum, col) => sum + (col.collection_payments || []).filter((p) => p.status === "pending").length * Number(col.amount_per_player || 0), 0);
    const pendingFines = (fines || []).filter((fine) => fine.status === "open").reduce((sum, fine) => sum + Number(fine.amount || 0), 0);
    const manualExpensesTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const courtCostsTotal = matches.filter((m) => m.status === "closed").reduce((sum, m) => sum + Number(m.court_cost || 0), 0);
    const totalExpense = manualExpensesTotal + courtCostsTotal;
    const totals = { canchas: courtCostsTotal, balones: 0, chalecos: 0, arbitraje: 0, comida: 0, otros: 0 };
    (expenses || []).forEach((exp) => { if (!exp) return; const cat = exp.category || "otros"; if (totals[cat] !== undefined) totals[cat] += Number(exp.amount || 0); else totals.otros += Number(exp.amount || 0); });
    return { finesIncome, matchFeesIncome, collectionsIncome, totalIncome, pendingReceivables: pendingFees + pendingCollections + pendingFines, manualExpensesTotal, courtCostsTotal, totalExpense, currentBalance: totalIncome - totalExpense, categoryTotals: totals };
  },
  myDebt({ matchFees, collections, profileId }) {
    const md = matchFees.filter((fee) => { const p = (fee.match_fee_payments || []).find((x) => x.profile_id === profileId); return p && p.status === "pending"; });
    const cd = collections.filter((col) => { const p = (col.collection_payments || []).find((x) => x.profile_id === profileId); return p && p.status === "pending"; });
    return md.reduce((s, fee) => s + Number(fee.per_player_amount), 0) + cd.reduce((s, col) => s + Number(col.amount_per_player), 0);
  },
};

// Deterministic pseudo-random fixtures (no Math.random, so failures are reproducible).
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function fixture(seed) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const players = ["p1", "p2", "p3", "p4", "p5"];
  const day = () => `2026-${String(1 + Math.floor(r() * 11)).padStart(2, "0")}-${String(1 + Math.floor(r() * 27)).padStart(2, "0")}`;
  const matches = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, title: r() > 0.2 ? `Partido ${i}` : "", status: pick(["closed", "upcoming", "closed"]), court_cost: pick([0, 150, "175", null]), match_date: day(), venue: pick(["Plaza 1", "Domo", null]), venue_id: pick(["v1", "v2", null]) }));
  const pay = (prefix) => players.map((pid, j) => ({ id: `${prefix}-${j}`, profile_id: pid, status: pick(["paid", "pending", "forgiven", "pending"]), proof_status: pick([null, "pending", "submitted", "approved", "rejected"]), created_at: r() > 0.5 ? `${day()}T10:00:00Z` : undefined, profiles: r() > 0.5 ? { full_name: pid } : undefined }));
  const matchFees = matches.slice(0, 4).map((m, i) => ({ id: `f${i}`, match_id: m.id, per_player_amount: pick([30, "25", 37.5]), match_fee_payments: pay(`mf${i}`) }));
  const collections = [0, 1, 2].map((i) => ({ id: `c${i}`, title: `Col ${i}`, status: pick(["open", "closed"]), amount_per_player: pick([50, 20]), due_date: r() > 0.5 ? day() : null, collection_payments: pay(`cp${i}`) }));
  const fines = Array.from({ length: 7 }, (_, i) => ({ id: `fn${i}`, profile_id: pick(players), status: pick(["open", "paid", "forgiven"]), amount: pick([25, "10", 50]), reason: pick(["no_show", "late_cancel", "custom text"]), created_at: `${day()}T12:00:00Z` }));
  const expenses = Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, description: `Gasto ${i}`, amount: pick([200, "120", 15.5]), category: pick(["balones", "chalecos", "otros", "unknown", undefined]), expense_date: r() > 0.3 ? day() : undefined }));
  return { matches, matchFees, collections, fines, expenses };
}

describe("finance model keeps the previous money rules exactly", () => {
  it("treasury totals match the original TreasuryPage formulas on 40 fixtures", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const fx = fixture(seed);
      const got = treasurySummary(fx);
      const ref = REF.treasury(fx);
      for (const k of Object.keys(ref)) expect(got[k], `seed ${seed} ${k}`).toEqual(ref[k]);
    }
  });

  it("ledger has the same entries, signs and date-descending order", () => {
    const fx = fixture(7);
    const ledger = treasuryLedger(fx);
    const paidFines = fx.fines.filter((f) => f.status === "paid").length;
    const paidFees = fx.matchFees.flatMap((f) => f.match_fee_payments).filter((p) => p.status === "paid").length;
    const paidCols = fx.collections.flatMap((c) => c.collection_payments).filter((p) => p.status === "paid").length;
    const courts = fx.matches.filter((m) => m.status === "closed" && Number(m.court_cost || 0) > 0).length;
    expect(ledger).toHaveLength(paidFines + paidFees + paidCols + courts + fx.expenses.length);
    for (let i = 1; i < ledger.length; i++) expect(ledger[i - 1].date.localeCompare(ledger[i].date)).toBeGreaterThanOrEqual(0);
    const income = ledger.filter((l) => l.type === "income").reduce((s, l) => s + l.amount, 0);
    expect(income).toBe(treasurySummary(fx).totalIncome);
    expect(ledger.filter((l) => l.isManual).map((l) => l.rawId).sort()).toEqual(fx.expenses.map((e) => e.id).sort());
  });

  it("player debt equals the former MyFeesPanel total", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const fx = fixture(seed);
      for (const pid of ["p1", "p3", "nobody"]) {
        expect(myPendingDebts({ ...fx, profileId: pid }).totalDebt).toBe(REF.myDebt({ ...fx, profileId: pid }));
      }
    }
  });

  it("collections summary keeps paid/pending/forgiven counts and progress", () => {
    const fx = fixture(3);
    const byId = new Map(["p1", "p2", "p3", "p4", "p5"].map((id) => [id, { id, nickname: id.toUpperCase() }]));
    summarizeCollections(fx.collections, byId).forEach(({ col, paid, pending, forgiven, progress, totalCollected }) => {
      const ps = col.collection_payments;
      expect(paid.length + pending.length + forgiven.length).toBe(ps.length);
      expect(progress).toBe(Math.round((paid.length / ps.length) * 100));
      expect(totalCollected).toBe(paid.length * col.amount_per_player);
    });
  });

  it("fine visibility: admins see all, players only their own; totals only count open fines", () => {
    const fines = [
      { id: "1", profile_id: "a", status: "open", amount: 25, created_at: "2026-11-18T00:00:00Z" },
      { id: "2", profile_id: "b", status: "open", amount: "10", created_at: "2026-11-18T00:00:00Z" },
      { id: "3", profile_id: "a", status: "paid", amount: 50, created_at: "2026-06-01T00:00:00Z" },
    ];
    expect(visibleFinesFor({ fines, isAdmin: true, profileId: "a" })).toHaveLength(3);
    expect(visibleFinesFor({ fines, isAdmin: false, profileId: "a" }).map((f) => f.id)).toEqual(["1", "3"]);
    expect(visibleFinesFor({ fines, isAdmin: true, range: "week", now: new Date("2026-11-20T12:00:00Z") }).map((f) => f.id)).toEqual(["1", "2"]);
    expect(fineTotals(visibleFinesFor({ fines, isAdmin: true }))).toEqual({ openTotal: 35, open: 2, paid: 1, forgiven: 0 });
  });

  it("payment captions keep the old precedence", () => {
    expect(paymentStateLabel({ status: "paid", proof_status: "submitted" })).toBe("Pagó");
    expect(paymentStateLabel({ status: "forgiven" })).toBe("Perdonado");
    expect(paymentStateLabel({ status: "pending", proof_status: "submitted" })).toBe("Esperando revisión");
    expect(paymentStateLabel({ status: "pending", proof_status: "rejected" })).toBe("Comprobante rechazado");
    expect(paymentStateLabel({ status: "pending", proof_status: null })).toBe("Pendiente");
  });

  it("venue history and reservation ordering are unchanged", () => {
    const h = venueHistory({ id: "v1", name: "Domo", default_cost: 99 }, [
      { venue_id: "v1", court_cost: 100, match_date: "2026-10-01" }, { venue: "Domo", court_cost: 0, match_date: "2026-11-01" }, { venue: "Otra", court_cost: 50 },
    ]);
    expect(h).toEqual({ count: 2, totalCost: 100, averageCost: 100, latestDate: "2026-11-01" });
    const rs = [
      { id: "a", status: "pending", created_at: "2026-11-01" }, { id: "b", status: "pending", created_at: "2026-11-05" },
      { id: "c", status: "confirmed", reservation_date: "2026-10-01" }, { id: "d", status: "confirmed", reservation_date: "2026-12-01" },
    ];
    const { pending, confirmed } = splitReservations(rs, new Set(["a"]));
    expect(pending.map((r) => r.id)).toEqual(["a", "b"]);
    expect(confirmed.map((r) => r.id)).toEqual(["d", "c"]);
    expect([visibleLimit("3", false, 9), visibleLimit("10", false, 9), visibleLimit("3", true, 9), visibleLimit("all", false, 9)]).toEqual([3, 10, 9, 9]);
    const assisted = assistedReservationsFor({ isAdmin: false, currentUserId: "u1", matches: [
      { id: "1", requires_reservation: true, reservation_owner_user_id: "u1" }, { id: "2", requires_reservation: true, reservation_owner_user_id: "u2" }, { id: "3" },
    ] });
    expect(assisted.all.map((m) => m.id)).toEqual(["1"]);
  });

  it("month calendar places reservations on their day (Monday-first, 6 weeks)", () => {
    const cal = monthCalendar(new Date(2026, 10, 1), { reservations: [{ id: "r", reservation_date: "2026-11-25", status: "pending", venue: "Domo", reservation_time: "19:00" }] });
    expect(cal.cells).toHaveLength(42);
    expect(cal.cells[0].key).toBe("2026-10-26");
    expect(cal.cells.find((c) => c.key === "2026-11-25").items[0]).toMatchObject({ venue: "Domo", status: "pending" });
  });

  it("negative balances keep their minus sign", () => {
    const { container } = render(<Money value={-215} />);
    expect(container.textContent).toMatch(/^−/);
  });
});

/* ---------------------------------------------------------------- UI roles */
const byId = new Map([["me", { id: "me", nickname: "Yo" }], ["x", { id: "x", nickname: "Otro" }]]);
const fee = { id: "f1", match_id: "m1", group_id: "g", per_player_amount: 30, match_fee_payments: [
  { id: "p-me", profile_id: "me", group_id: "g", status: "pending", proof_status: "submitted", proof_url: "data:image/png;base64,AA==" },
  { id: "p-x", profile_id: "x", group_id: "g", status: "pending", proof_status: null, proof_url: null },
] };
const feeProps = { collections: [], matchFees: [fee], matches: [{ id: "m1", title: "Jueves", match_date: "2026-11-26", start_time: "19:00" }], profile: { id: "me" }, profileById: byId };

describe("Cobros UI respects roles and calls the same handlers", () => {
  it("player sees only their own debt and no admin actions", () => {
    render(<FeesPage {...feeProps} isAdmin={false} />);
    expect(screen.getAllByText("Jueves").length).toBeGreaterThan(0);
    expect(screen.queryByText("Otro")).toBeNull();
    expect(screen.queryByLabelText("Marcar como pagado")).toBeNull();
    expect(screen.queryByLabelText("Perdonar cuota")).toBeNull();
  });

  it("admin approve / forgive / proof review use the existing callbacks", () => {
    const onUpdateMatchFeePayment = vi.fn();
    const onReviewProof = vi.fn().mockResolvedValue();
    render(<FeesPage {...feeProps} isAdmin onUpdateMatchFeePayment={onUpdateMatchFeePayment} onReviewProof={onReviewProof} onUpdateMatchFee={vi.fn()} />);
    const row = screen.getByText("Otro").closest("li");
    fireEvent.click(within(row).getByLabelText("Marcar como pagado"));
    expect(onUpdateMatchFeePayment).toHaveBeenCalledWith("p-x", { status: "paid" });
    fireEvent.click(within(row).getByLabelText("Perdonar cuota"));
    expect(onUpdateMatchFeePayment).toHaveBeenCalledWith("p-x", { status: "forgiven" });
    fireEvent.click(screen.getByLabelText("Ver comprobante"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aprobar" }));
    expect(onReviewProof).toHaveBeenCalledWith("p-me", "match_fee", "approved");
  });

  it("player fines: only own, no settle buttons", () => {
    const fines = [{ id: "1", profile_id: "me", status: "open", amount: 25, reason: "no_show", created_at: new Date().toISOString() }, { id: "2", profile_id: "x", status: "open", amount: 10, reason: "late_cancel", created_at: new Date().toISOString() }];
    render(<FinesPage fines={fines} isAdmin={false} matches={[]} profile={{ id: "me" }} profileById={byId} profiles={[]} />);
    expect(screen.getByRole("heading", { name: /Mis multas/ })).toBeTruthy();
    expect(screen.getAllByText(/No llegó/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Canceló tarde/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar pagada" })).toBeNull();
  });
});

describe("Reservas UI keeps confirmation rules", () => {
  const reservations = [{ id: "r-1", venue: "Domo", reservation_date: "2026-11-26", reservation_time: "20:00", status: "pending", assigned_to: "me", proof_url: null, assigned_profile: { id: "me", nickname: "Yo" } }];
  const base = { activeGroupId: "g", profiles: [], venues: [], matches: [], attendances: [], groupTags: [], currentUserId: "me", isDemoMode: true, reservations, setReservations: vi.fn() };

  it("confirm needs a proof and delete is super-admin only", () => {
    const { rerender } = render(<CourtReservationPage {...base} isAdmin isSuperAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Tarjetas" }));
    expect(screen.getByRole("button", { name: "Confirmar y crear partido" }).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Eliminar/ })).toBeNull();
    rerender(<CourtReservationPage {...base} isAdmin isSuperAdmin />);
    expect(screen.getByRole("button", { name: /Eliminar/ })).toBeTruthy();
  });

  it("calendar shows the reservation and the day detail opens its card", () => {
    render(<CourtReservationPage {...base} isAdmin={false} isSuperAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Calendario" }));
    // Navigate to November 2026 if the test runs in another month.
    const label = () => screen.getByRole("grid").getAttribute("aria-label");
    for (let i = 0; i < 36 && !/noviembre de 2026/i.test(label()); i++) {
      const target = new Date(2026, 10, 1); const now = new Date();
      fireEvent.click(screen.getByLabelText(now < target ? "Mes siguiente" : "Mes anterior"));
    }
    fireEvent.click(screen.getByRole("gridcell", { name: /^26, 1 reserva/ }));
    expect(screen.getByRole("article", { name: /Reserva Domo/ })).toBeTruthy();
  });
});
