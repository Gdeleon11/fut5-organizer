/**
 * F5 Matchday — view model shared by both experiences (Editorial / Command Center).
 *
 * Pure functions only: they read the same match/attendance/profile data the app
 * already loads and reproduce the existing rules (AttendanceAction + App handlers).
 * They never decide anything the backend does not already enforce.
 */
import { displayName, waitlistPosition } from "../utils.js";

export const MATCH_STATES = ["confirmed", "available", "waitlist", "full", "cancelled", "finished", "empty"];
export const DEFAULT_CAPACITY = 15;
export const LATE_CANCEL_HOURS = 4;

const CONFIRMED = ["confirmed", "checked_in"];
const DOW = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MON = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function localISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function matchCapacity(match) {
  const n = Number(match?.max_players);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAPACITY;
}

export function matchTitle(match) {
  return match?.title || match?.venue || "Chamuscón";
}

/** Date pieces for typographic layouts. `whenTag` is relative (HOY / MAÑANA / EN N DÍAS). */
export function dateParts(match, now = new Date()) {
  const time = (match?.start_time || "").slice(0, 5);
  if (!match?.match_date) {
    return { day: "--", dow: "", mon: "", time, whenTag: "FECHA PENDIENTE", longLabel: "Fecha pendiente" };
  }
  const [y, m, d] = match.match_date.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((date - today) / 86400000);
  let whenTag = "";
  if (diff === 0) whenTag = "HOY";
  else if (diff === 1) whenTag = "MAÑANA";
  else if (diff > 1 && diff <= 6) whenTag = `EN ${diff} DÍAS`;
  else if (diff === -1) whenTag = "AYER";
  return {
    day: String(d).padStart(2, "0"),
    dow: DOW[date.getDay()],
    mon: MON[m - 1],
    year: y,
    time,
    whenTag,
    longLabel: `${DOW[date.getDay()]} ${String(d).padStart(2, "0")} ${MON[m - 1]}`,
  };
}

export function isFinishedMatch(match, now = new Date()) {
  if (!match) return false;
  if (match.status === "closed") return true;
  return Boolean(match.match_date && match.match_date < localISODate(now));
}

export function hoursUntil(match, now = new Date()) {
  if (!match?.match_date) return 99;
  const at = new Date(`${match.match_date}T${match.start_time || "00:00"}`);
  return (at - now) / 3600000;
}

/**
 * Derives the visible state + allowed actions for the current player on one match.
 * Action kinds: confirm | waitlist | cancel | open | summary.
 */
export function deriveMatchState({
  match,
  attendance = null,
  confirmedCount = 0,
  waitlistPos = null,
  profile = null,
  clearance = null,
  fineAmount = null,
  now = new Date(),
} = {}) {
  if (!match) {
    return {
      key: "empty",
      chip: "Sin próximos partidos",
      tone: "mute",
      status: "Sin próximos partidos",
      sub: "No hay convocatorias activas.",
      primary: null,
      secondary: null,
    };
  }

  const capacity = matchCapacity(match);
  const free = Math.max(0, capacity - confirmedCount);
  const status = attendance?.status || null;
  const lateCancel = hoursUntil(match, now) < LATE_CANCEL_HOURS;
  const cancelSuffix = lateCancel && fineAmount ? ` (multa Q${fineAmount})` : "";

  if (match.status === "canceled") {
    return {
      key: "cancelled",
      chip: "Cancelado",
      tone: "bad",
      status: "Partido cancelado",
      sub: "La convocatoria fue cerrada por la administración.",
      primary: { kind: "open", label: "Ver detalle" },
      secondary: null,
    };
  }

  if (isFinishedMatch(match, now)) {
    return {
      key: "finished",
      chip: "Finalizado",
      tone: "mute",
      status: `${confirmedCount} ${confirmedCount === 1 ? "jugó" : "jugaron"}`,
      sub: "El resumen y los equipos están disponibles.",
      primary: { kind: "summary", label: "Ver resumen" },
      secondary: null,
    };
  }

  if (status === "waitlist") {
    return {
      key: "waitlist",
      chip: "Lista de espera",
      tone: "warn",
      status: `Vas #${waitlistPos || "?"} en la lista de espera`,
      sub: "Te avisamos si se libera un cupo.",
      primary: { kind: "open", label: "Ver partido" },
      secondary: { kind: "cancel", label: `Cancelar espera${cancelSuffix}` },
    };
  }

  if (CONFIRMED.includes(status)) {
    const checkedIn = status === "checked_in" || attendance?.checked_in === true;
    return {
      key: "confirmed",
      chip: "Confirmado",
      tone: "ok",
      status: checkedIn ? "Ya estás registrado" : "Estás confirmado",
      sub: checkedIn ? "Tu llegada quedó registrada." : "Tu lugar está reservado.",
      primary: { kind: "open", label: "Ver partido" },
      secondary: checkedIn ? null : { kind: "cancel", label: `Cancelar asistencia${cancelSuffix}` },
    };
  }

  // Same gating as AttendanceAction: inactive profile, pending clearance or closed match.
  let blocked = null;
  if (profile && profile.is_active === false) {
    blocked = { label: "Perfil inactivo", reason: "Pedile a un admin que active tu perfil." };
  } else if (clearance && clearance.clear === false) {
    blocked = { label: "Sin finiquito", reason: "Tenés pagos pendientes. Pagá antes de sumarte a otro juego." };
  } else if (match.status && match.status !== "upcoming") {
    blocked = { label: "Cerrado", reason: "Este partido no está abierto para confirmar." };
  }

  const previous =
    status === "canceled"
      ? "Cancelaste tu asistencia. "
      : status === "no_show"
        ? "El admin te marcó como ausente. "
        : "";

  if (free <= 0) {
    return {
      key: "full",
      chip: "Completo",
      tone: "mute",
      status: `Partido completo · ${confirmedCount}/${capacity}`,
      sub: blocked ? blocked.reason : `${previous}Puedes anotarte en la lista de espera.`,
      primary: blocked
        ? { kind: "waitlist", label: blocked.label, disabled: true }
        : { kind: "waitlist", label: "Anotarme en espera" },
      secondary: { kind: "open", label: "Ver partido" },
    };
  }

  return {
    key: "available",
    chip: "Disponible",
    tone: "info",
    status: `${free} ${free === 1 ? "cupo disponible" : "cupos disponibles"}`,
    sub: blocked ? blocked.reason : `${previous}Confirma para reservar tu lugar.`,
    primary: blocked
      ? { kind: "confirm", label: blocked.label, disabled: true }
      : { kind: "confirm", label: status === "canceled" ? "Confirmar de nuevo" : "Confirmar asistencia" },
    secondary: { kind: "open", label: "Ver partido" },
  };
}

function initialOf(name) {
  return (String(name || "?").trim()[0] || "?").toUpperCase();
}

/** Confirmed players (members first, then guests) for slot/lineup rendering. */
export function confirmedRoster({ matchId, attendances = [], profiles = [], guests = {}, meId = null }) {
  const byId = new Map((profiles || []).filter(Boolean).map((p) => [p.id, p]));
  const members = (attendances || [])
    .filter((a) => a && a.match_id === matchId && CONFIRMED.includes(a.status))
    .map((a) => {
      const p = byId.get(a.profile_id) || a.profiles || null;
      const name = p ? displayName(p) : "Jugador";
      return { id: a.profile_id, name, initial: initialOf(name), isMe: a.profile_id === meId, isGuest: false, profile: p };
    });
  const guestRows = ((guests || {})[matchId] || []).map((g, i) => {
    const name = g?.name || g?.full_name || "Invitado";
    return { id: g?.id || `guest-${i}`, name, initial: initialOf(name), isMe: false, isGuest: true, profile: null, guestRating: g?.rating || null };
  });
  return [...members, ...guestRows];
}

export function confirmedCountFor(matchId, attendances = [], guests = {}) {
  const regular = (attendances || []).filter(
    (a) => a && a.match_id === matchId && CONFIRMED.includes(a.status),
  ).length;
  return regular + (((guests || {})[matchId] || []).length);
}

/** Builds one card/row entry. */
export function matchEntry(match, ctx) {
  const { attendances, profiles, guests, profile, clearance, fineAmount, now } = ctx;
  const meId = profile?.id || null;
  const attendance = (attendances || []).find((a) => a && a.match_id === match.id && a.profile_id === meId) || null;
  const confirmedCount = confirmedCountFor(match.id, attendances, guests);
  const capacity = matchCapacity(match);
  const waitlistPos = attendance?.status === "waitlist" ? waitlistPosition(match.id, meId, attendances) : null;
  const waitlistCount = (attendances || []).filter((a) => a && a.match_id === match.id && a.status === "waitlist").length;
  return {
    id: match.id,
    match,
    title: matchTitle(match),
    venue: match.venue || "",
    parts: dateParts(match, now),
    capacity,
    confirmedCount,
    free: Math.max(0, capacity - confirmedCount),
    fillRatio: Math.min(1, confirmedCount / capacity),
    waitlistCount,
    attendance,
    state: deriveMatchState({ match, attendance, confirmedCount, waitlistPos, profile, clearance, fineAmount, now }),
  };
}

/**
 * Picks the match the hero should feature:
 * the next upcoming one, otherwise a match from today (or later) that already
 * finished or was canceled, so those states stay visible on match day.
 */
export function pickFeatured({ nextMatch, pastMatches = [], now = new Date() }) {
  if (nextMatch) return nextMatch;
  const today = localISODate(now);
  return (pastMatches || []).find((m) => m?.match_date && m.match_date >= today) || null;
}

export function buildMatchdayModel({
  nextMatch,
  upcoming = [],
  pastMatches = [],
  attendances = [],
  profiles = [],
  guests = {},
  profile = null,
  clearance = null,
  fineAmount = null,
  now = new Date(),
}) {
  const ctx = { attendances, profiles, guests, profile, clearance, fineAmount, now };
  const featuredMatch = pickFeatured({ nextMatch, pastMatches, now });
  const featured = featuredMatch
    ? {
        ...matchEntry(featuredMatch, ctx),
        roster: confirmedRoster({ matchId: featuredMatch.id, attendances, profiles, guests, meId: profile?.id }),
      }
    : null;
  const agenda = (upcoming || []).filter((m) => m && m.id !== featuredMatch?.id).map((m) => matchEntry(m, ctx));
  const history = (pastMatches || []).filter((m) => m && m.id !== featuredMatch?.id).map((m) => matchEntry(m, ctx));
  const lastPlayed = featured ? null : history.find((h) => h.state.key === "finished") || null;
  return {
    featured,
    agenda,
    history,
    lastPlayed,
    heroState: featured ? featured.state : deriveMatchState({ match: null }),
  };
}
