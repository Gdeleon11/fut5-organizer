/*
 * F5 Premium — Entrega 3: finance & reservation read model.
 *
 * Every function here is a verbatim extraction of the calculation that used to live
 * inline in TreasuryPage / FeesPage / FinesPage / VenuesPage / CourtReservationPage.
 * Rules are NOT changed: same statuses, same sums, same sort orders. The equivalence
 * is pinned by src/__tests__/finance.test.jsx against copies of the original code.
 */
import { displayName, formatMoney } from "../utils.js";
import { activeReservationStatus } from "../reservationAssistant.js";

export const CATEGORY_LABELS = {
  canchas: "⚽ Canchas",
  balones: "⚽ Balones",
  chalecos: "🎽 Chalecos",
  arbitraje: "🏁 Arbitraje",
  comida: "🍔 Comida/Bebida",
  otros: "🔧 Otros",
};

/* ---------------------------------------------------------------- Treasury */

export function treasurySummary({ fines = [], matchFees = [], collections = [], expenses = [], matches = [] }) {
  const finesIncome = fines
    .filter((f) => f.status === "paid")
    .reduce((sum, f) => sum + Number(f.amount || 0), 0);

  const matchFeesIncome = matchFees.reduce((sum, fee) => {
    const paidPaymentsCount = (fee.match_fee_payments || []).filter((p) => p.status === "paid").length;
    return sum + paidPaymentsCount * Number(fee.per_player_amount || 0);
  }, 0);

  const collectionsIncome = (collections || []).reduce((sum, col) => {
    const paidPaymentsCount = (col.collection_payments || []).filter((p) => p.status === "paid").length;
    return sum + paidPaymentsCount * Number(col.amount_per_player || 0);
  }, 0);

  const totalIncome = finesIncome + matchFeesIncome + collectionsIncome;

  const pendingFees = (matchFees || []).reduce((sum, fee) => {
    const pending = (fee.match_fee_payments || []).filter((p) => p.status === "pending").length;
    return sum + pending * Number(fee.per_player_amount || 0);
  }, 0);
  const pendingCollections = (collections || []).reduce((sum, col) => {
    const pending = (col.collection_payments || []).filter((p) => p.status === "pending").length;
    return sum + pending * Number(col.amount_per_player || 0);
  }, 0);
  const pendingFines = (fines || [])
    .filter((fine) => fine.status === "open")
    .reduce((sum, fine) => sum + Number(fine.amount || 0), 0);
  const pendingReceivables = pendingFees + pendingCollections + pendingFines;

  const manualExpensesTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const courtCostsTotal = matches
    .filter((m) => m.status === "closed")
    .reduce((sum, m) => sum + Number(m.court_cost || 0), 0);
  const totalExpense = manualExpensesTotal + courtCostsTotal;

  const categoryTotals = { canchas: courtCostsTotal, balones: 0, chalecos: 0, arbitraje: 0, comida: 0, otros: 0 };
  (expenses || []).forEach((exp) => {
    if (!exp) return;
    const cat = exp.category || "otros";
    if (categoryTotals[cat] !== undefined) categoryTotals[cat] += Number(exp.amount || 0);
    else categoryTotals.otros += Number(exp.amount || 0);
  });

  return {
    finesIncome,
    matchFeesIncome,
    collectionsIncome,
    totalIncome,
    pendingReceivables,
    pendingBreakdown: { fees: pendingFees, collections: pendingCollections, fines: pendingFines },
    manualExpensesTotal,
    courtCostsTotal,
    totalExpense,
    currentBalance: totalIncome - totalExpense,
    categoryTotals,
  };
}

/** Expense categories with amount > 0, largest first, with the same rounded percentage as before. */
export function expenseDistribution(categoryTotals, totalExpense) {
  return Object.entries(categoryTotals)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, amount]) => ({ key, label: CATEGORY_LABELS[key] || key, amount, percentage: Math.round((amount / totalExpense) * 100) }));
}

export function treasuryLedger({ fines = [], matchFees = [], collections = [], expenses = [], matches = [] }) {
  const list = [];

  fines
    .filter((f) => f.status === "paid")
    .forEach((f) => {
      list.push({
        id: `fine-${f.id}`,
        type: "income",
        source: "fine",
        title: `Multa pagada - ${f.profiles?.full_name || "Jugador"}`,
        description: `Motivo: ${f.reason}`,
        amount: Number(f.amount || 0),
        date: f.created_at ? f.created_at.split("T")[0] : "",
      });
    });

  matchFees.forEach((fee) => {
    const match = matches.find((m) => m.id === fee.match_id);
    const matchTitle = match ? match.title || "Partido" : "Partido";
    const matchDate = match ? match.match_date : "";
    (fee.match_fee_payments || [])
      .filter((p) => p.status === "paid")
      .forEach((p) => {
        list.push({
          id: `payment-${p.id}`,
          type: "income",
          source: "match_fee",
          title: `Cuota partido - ${p.profiles?.full_name || "Jugador"}`,
          description: `${matchTitle} (${matchDate})`,
          amount: Number(fee.per_player_amount || 0),
          date: p.created_at ? p.created_at.split("T")[0] : matchDate,
        });
      });
  });

  collections.forEach((col) => {
    (col.collection_payments || [])
      .filter((p) => p.status === "paid")
      .forEach((p) => {
        list.push({
          id: `collection-payment-${p.id}`,
          type: "income",
          source: "collection",
          title: `Colaboración - ${p.profiles?.full_name || "Jugador"}`,
          description: col.title || "Colaboración extra",
          amount: Number(col.amount_per_player || 0),
          date: p.created_at ? p.created_at.split("T")[0] : col.due_date || "",
        });
      });
  });

  matches
    .filter((m) => m.status === "closed" && Number(m.court_cost || 0) > 0)
    .forEach((m) => {
      list.push({
        id: `court-cost-${m.id}`,
        type: "expense",
        source: "court",
        title: `Alquiler de cancha - ${m.title || "Partido"}`,
        description: `Sede: ${m.venue || "Cancha"}`,
        amount: Number(m.court_cost || 0),
        date: m.match_date || "",
      });
    });

  expenses.forEach((exp) => {
    list.push({
      id: `expense-${exp.id}`,
      type: "expense",
      source: "manual",
      title: `Gasto: ${exp.description}`,
      description: `Categoría: ${CATEGORY_LABELS[exp.category] || exp.category}`,
      amount: Number(exp.amount || 0),
      date: exp.expense_date || "",
      isManual: true,
      rawId: exp.id,
    });
  });

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/* ------------------------------------------------------- Payment statuses */

export const PROOF_LABELS = {
  submitted: "Comprobante enviado",
  approved: "Comprobante aprobado",
  rejected: "Comprobante rechazado",
};

/** Row caption for a fee/collection payment (same precedence as the old nested ternary). */
export function paymentStateLabel(payment) {
  const proofStatus = payment.proof_status;
  if (payment.status === "paid") return "Pagó";
  if (payment.status === "forgiven") return "Perdonado";
  if (proofStatus === "submitted") return "Esperando revisión";
  if (proofStatus === "approved") return "Comprobante aprobado";
  if (proofStatus === "rejected") return "Comprobante rechazado";
  return "Pendiente";
}

/** Visual tone for a payment, used only for styling. */
export function paymentTone(payment) {
  if (payment.status === "paid") return "paid";
  if (payment.status === "forgiven") return "forgiven";
  if (payment.proof_status === "submitted") return "review";
  if (payment.proof_status === "rejected") return "rejected";
  return "pending";
}

/** Player-side short label for proof_status (old MyFeesPanel pill). */
export function myProofPillLabel(proofStatus) {
  return proofStatus === "submitted" ? "Enviado" : proofStatus === "approved" ? "Aprobado" : "Rechazado";
}

export function sortPaymentsByName(payments, profileById) {
  return [...payments].sort((a, b) => {
    const nameA = displayName(profileById.get(a.profile_id)) || "";
    const nameB = displayName(profileById.get(b.profile_id)) || "";
    return nameA.localeCompare(nameB);
  });
}

/* ------------------------------------------------------------- Collections */

export function summarizeCollections(collections, profileById) {
  return (collections || []).map((col) => {
    const payments = col.collection_payments || [];
    const pending = payments.filter((p) => p.status === "pending");
    const paid = payments.filter((p) => p.status === "paid");
    const forgiven = payments.filter((p) => p.status === "forgiven");
    const pendingNames = pending
      .map((p) => displayName(profileById.get(p.profile_id)))
      .sort((a, b) => a.localeCompare(b));
    const progress = payments.length ? Math.round((paid.length / payments.length) * 100) : 0;
    return { col, payments, pending, paid, forgiven, pendingNames, progress, totalCollected: paid.length * col.amount_per_player };
  });
}

export function collectionsWhatsappSummary(summaries) {
  const lines = ["COBROS F5MANAGER", ""];
  summaries
    .filter(({ col, pending }) => col.status === "open" && pending.length > 0)
    .forEach(({ col, pendingNames }) => {
      lines.push(`${col.title} - ${formatMoney(col.amount_per_player)}`);
      lines.push(`Pendientes: ${pendingNames.join(", ")}`);
      if (col.due_date) {
        lines.push(`Vence: ${new Date(col.due_date + "T12:00:00").toLocaleDateString("es-GT")}`);
      }
      lines.push("");
    });
  if (lines.length === 2) lines.push("No hay pendientes abiertos.");
  return lines.join("\n").trim();
}

export function filterPaymentsByStatus(payments, statusFilter) {
  if (statusFilter === "all") return payments;
  return payments.filter((payment) => payment.status === statusFilter);
}

/** Match fees summary for the admin board (counts only; no new money rule). */
export function summarizeMatchFee(fee) {
  const payments = fee?.match_fee_payments || [];
  const count = (s) => payments.filter((p) => p.status === s).length;
  const paid = count("paid");
  return {
    total: payments.length,
    paid,
    pending: count("pending"),
    forgiven: count("forgiven"),
    toReview: payments.filter((p) => p.proof_url && p.proof_status === "submitted").length,
    collected: paid * Number(fee?.per_player_amount || 0),
    progress: payments.length ? Math.round((paid / payments.length) * 100) : 0,
  };
}

/* --------------------------------------------------------------- My debts */

export function myPendingDebts({ matchFees = [], collections = [], matches = [], profileId }) {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const myMatchDebts = matchFees
    .filter((fee) => {
      const myPayment = (fee.match_fee_payments || []).find((p) => p.profile_id === profileId);
      return myPayment && myPayment.status === "pending";
    })
    .map((fee) => {
      const myPayment = fee.match_fee_payments.find((p) => p.profile_id === profileId);
      return { fee, payment: myPayment, match: matchById.get(fee.match_id) };
    });

  const myCollectionDebts = collections
    .filter((col) => {
      const myPayment = (col.collection_payments || []).find((p) => p.profile_id === profileId);
      return myPayment && myPayment.status === "pending";
    })
    .map((col) => {
      const myPayment = col.collection_payments.find((p) => p.profile_id === profileId);
      return { col, payment: myPayment };
    });

  const totalDebt =
    myMatchDebts.reduce((s, { fee }) => s + Number(fee.per_player_amount), 0) +
    myCollectionDebts.reduce((s, { col }) => s + Number(col.amount_per_player), 0);

  return { myMatchDebts, myCollectionDebts, totalDebt };
}

/* ------------------------------------------------------------------ Fines */

export const DATE_RANGES = [
  { id: "all", label: "Todas" },
  { id: "week", label: "Última semana" },
  { id: "month", label: "Último mes" },
  { id: "3months", label: "Últimos 3 meses" },
];

export function filterFinesByDateRange(fines, range, now = new Date()) {
  if (range === "all") return fines;
  const cutoff = new Date(now);
  if (range === "week") cutoff.setDate(now.getDate() - 7);
  else if (range === "month") cutoff.setMonth(now.getMonth() - 1);
  else if (range === "3months") cutoff.setMonth(now.getMonth() - 3);
  return fines.filter((f) => new Date(f.created_at) >= cutoff);
}

/** Admins see every fine; players only their own (unchanged visibility rule). */
export function visibleFinesFor({ fines = [], isAdmin, profileId, range = "all", now }) {
  return isAdmin
    ? filterFinesByDateRange(fines, range, now)
    : filterFinesByDateRange(fines.filter((f) => f.profile_id === profileId), range, now);
}

export function fineTotals(visibleFines) {
  return {
    openTotal: visibleFines.filter((f) => f.status === "open").reduce((t, f) => t + Number(f.amount || 0), 0),
    open: visibleFines.filter((f) => f.status === "open").length,
    paid: visibleFines.filter((f) => f.status === "paid").length,
    forgiven: visibleFines.filter((f) => f.status === "forgiven").length,
  };
}

/* ----------------------------------------------------------------- Venues */

export function venueMapUrl(venue) {
  if (venue.lat && venue.lng) return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venue.name, venue.address].filter(Boolean).join(" "))}`;
}

export function venueHistory(venue, matches = []) {
  const usedMatches = (matches || []).filter((match) => match && (match.venue_id === venue.id || match.venue === venue.name));
  const totalCost = usedMatches.reduce((sum, match) => sum + Number(match.court_cost || 0), 0);
  const withCost = usedMatches.filter((match) => Number(match.court_cost || 0) > 0);
  const latest = [...usedMatches]
    .filter((match) => match.match_date)
    .sort((a, b) => b.match_date.localeCompare(a.match_date))[0];
  return {
    count: usedMatches.length,
    totalCost,
    averageCost: withCost.length ? totalCost / withCost.length : Number(venue.default_cost || 0),
    latestDate: latest?.match_date || null,
  };
}

export function venueShareText(venue) {
  return [
    "CANCHA F5MANAGER",
    "",
    venue.name,
    venue.address ? `Dirección: ${venue.address}` : "",
    Number(venue.default_cost || 0) > 0 ? `Costo típico: ${formatMoney(venue.default_cost)}` : "",
    venue.notes ? `Notas: ${venue.notes}` : "",
    `Mapa: ${venueMapUrl(venue)}`,
  ].filter(Boolean).join("\n");
}

/* ----------------------------------------------------------- Reservations */

export function reservationDateLabel(date, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return date ? new Date(date + "T12:00:00").toLocaleDateString("es-GT", opts) : "";
}

/** Pending (newly created first, then most recent) and confirmed (latest date first), as before. */
export function splitReservations(reservations = [], newlyCreatedIds = new Set()) {
  const pending = reservations.filter((r) => r.status === "pending");
  pending.sort((a, b) => {
    const aNew = newlyCreatedIds.has(a.id) ? 1 : 0;
    const bNew = newlyCreatedIds.has(b.id) ? 1 : 0;
    if (aNew !== bNew) return bNew - aNew;
    return (b.created_at || b.reservation_date || "").localeCompare(a.created_at || a.reservation_date || "");
  });
  const confirmed = reservations.filter((r) => r.status === "confirmed");
  confirmed.sort((a, b) => (b.reservation_date || "").localeCompare(a.reservation_date || ""));
  return { pending, confirmed };
}

export function visibleLimit(rangeFilter, expanded, total) {
  if (rangeFilter === "3" && !expanded) return 3;
  if (rangeFilter === "10" && !expanded) return 10;
  return total;
}

export function groupReservationsByDate(reservations = []) {
  const groups = {};
  reservations.forEach((r) => {
    const key = r.reservation_date || "Sin fecha";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  return { groups, dates: Object.keys(groups).sort().reverse() };
}

/** Assisted reservations: admins see all, others only those they own (unchanged rule). */
export function assistedReservationsFor({ matches = [], isAdmin, currentUserId }) {
  const all = matches
    .filter((match) => match.requires_reservation)
    .filter((match) => isAdmin || match.reservation_owner_user_id === currentUserId);
  return {
    all,
    pending: all.filter((m) => activeReservationStatus(m) === "pending"),
    failed: all.filter((m) => activeReservationStatus(m) === "failed"),
    confirmed: all.filter((m) => activeReservationStatus(m) === "confirmed"),
  };
}

export function reservationToken(id) {
  return id.replace(/-/g, "");
}

export function reservationWhatsappText(reservation, origin, dateStr) {
  return `¡Hola ${displayName(reservation.assigned_profile)}! Te asigné la reserva de la cancha *${reservation.venue}* (${dateStr} ${reservation.reservation_time || ""}). Por favor subí tu comprobante acá:\n${origin}/reserve/${reservationToken(reservation.id)}`;
}

/**
 * Month grid for the calendar view (presentation only). Weeks start on Monday.
 * Returns 6×7 cells with the reservations and assisted matches of each day.
 */
export function monthCalendar(anchor, { reservations = [], assisted = [] } = {}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const byDay = new Map();
  const push = (k, item) => { if (!k) return; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(item); };
  reservations.forEach((r) => push(r.reservation_date, { kind: "reservation", id: r.id, status: r.status, venue: r.venue, time: r.reservation_time, ref: r }));
  assisted.forEach((m) => push(m.match_date, { kind: "assisted", id: m.id, status: activeReservationStatus(m), venue: m.venue, time: m.start_time, ref: m }));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const k = key(d);
    cells.push({ key: k, day: d.getDate(), inMonth: d.getMonth() === month, items: (byDay.get(k) || []).sort((a, b) => (a.time || "").localeCompare(b.time || "")) });
  }
  return { year, month, cells, label: first.toLocaleDateString("es-GT", { month: "long", year: "numeric" }) };
}
