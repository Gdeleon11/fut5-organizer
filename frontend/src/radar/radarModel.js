/* F5 Radar — pure helpers shared by the Radar page, the admin panel and the bell.
 * The server enforces every rule; these only format data and mirror rules for the UI. */
import { POSITION_LABELS } from "../constants.js";

export const RADAR_TZ_OFFSET_HOURS = -6; // America/Guatemala, no DST (same zone as the server rules)
export const LATE_CANCEL_HOURS = 4;
export const MAX_MESSAGE = 280;

export const LEVEL_OPTIONS = [
  { value: "any", label: "Todos los niveles" },
  { value: "casual", label: "Casual" },
  { value: "intermedio", label: "Intermedio" },
  { value: "competitivo", label: "Competitivo" },
];

export const RADAR_POSITIONS = ["Flexible", "Goalkeeper", "Defender", "Midfielder", "Forward"];

const REQUEST_STATUS = {
  pending: { label: "Pendiente", tone: "warn" },
  approved: { label: "Aceptada", tone: "ok" },
  rejected: { label: "No aceptada", tone: "bad" },
  withdrawn: { label: "Retirada", tone: "muted" },
  canceled: { label: "Cancelada", tone: "muted" },
  expired: { label: "Expirada", tone: "muted" },
};

const LISTING_STATUS = {
  open: "Abierta",
  paused: "Pausada",
  closed: "Cerrada",
};

export function levelLabel(level) {
  return LEVEL_OPTIONS.find((o) => o.value === level)?.label || "Todos los niveles";
}

export function requestStatus(status) {
  return REQUEST_STATUS[status] || { label: status || "—", tone: "muted" };
}

export function listingStatusLabel(status) {
  return LISTING_STATUS[status] || "Privado";
}

export function positionsLabel(positions = []) {
  if (!positions || positions.length === 0) return "Cualquier posición";
  return positions.map((p) => POSITION_LABELS[p] || p).join(" · ");
}

/** Match start as a Date, reading match_date + start_time in the app's time zone. */
export function matchStartsAt(matchDate, startTime) {
  if (!matchDate) return null;
  const hhmm = /^\d{1,2}:\d{2}/.test(startTime || "") ? startTime.match(/^\d{1,2}:\d{2}/)[0] : "00:00";
  const [h, m] = hhmm.split(":").map(Number);
  const [y, mo, d] = String(matchDate).split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - RADAR_TZ_OFFSET_HOURS, m));
}

export function isLateCancel(startsAt, now = new Date()) {
  if (!startsAt) return false;
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  return (start - now) / 3_600_000 < LATE_CANCEL_HOURS;
}

export function slotsLabel(left) {
  const n = Number(left) || 0;
  return n === 1 ? "1 cupo Radar" : `${n} cupos Radar`;
}

export function occupancyLabel(occupancy, max) {
  return max ? `${occupancy}/${max} confirmados` : `${occupancy} confirmados`;
}

export function money(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return `Q${n.toLocaleString("es-GT", { maximumFractionDigits: 2 })}`;
}

const DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export function shortDate(matchDate, startTime) {
  if (!matchDate) return "";
  const [y, m, d] = String(matchDate).split("-").map(Number);
  const dow = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}${startTime ? ` · ${startTime.slice(0, 5)}` : ""}`;
}

/** Round coordinates on the device (≈1 km) before sending them. Never stored. */
export function roundCoords(lat, lng) {
  const r = (v) => Math.round(Number(v) * 100) / 100;
  if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) return null;
  return { lat: r(lat), lng: r(lng) };
}

export function dateWindow(range, today = new Date()) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const local = new Date(today.getTime() + RADAR_TZ_OFFSET_HOURS * 3_600_000);
  const from = iso(local);
  const days = range === "today" ? 0 : range === "week" ? 7 : 14;
  const to = iso(new Date(local.getTime() + days * 86_400_000));
  return { from, to };
}

/** Split my requests into upcoming/active and history for "Mis partidos y solicitudes". */
export function splitMyRequests(requests = [], now = new Date()) {
  const active = [];
  const history = [];
  for (const r of requests) {
    const starts = r.listing?.starts_at ? new Date(r.listing.starts_at) : null;
    const live = ["pending", "approved"].includes(r.status) && (!starts || starts > now);
    (live ? active : history).push(r);
  }
  return { active, history };
}

export function canCancelSpot(request, now = new Date()) {
  if (request?.status !== "approved") return false;
  const starts = request.listing?.starts_at ? new Date(request.listing.starts_at) : null;
  return !starts || starts > now;
}

/** Validates the publish form before calling the server (the server checks again). */
export function validatePublishForm({ radarSlots, freeSlots, zoneLabel, note }) {
  const slots = Number(radarSlots);
  if (!Number.isInteger(slots) || slots < 1) return "Indicá al menos 1 cupo para Radar.";
  if (freeSlots != null && slots > freeSlots) return `Solo quedan ${freeSlots} cupos libres en el partido.`;
  const zone = (zoneLabel || "").trim();
  if (zone && (zone.length < 2 || zone.length > 60)) return "La zona debe tener entre 2 y 60 caracteres.";
  if ((note || "").length > 200) return "La nota admite hasta 200 caracteres.";
  return null;
}

/** Why a match cannot be published, mirroring the server checks for a clear UI message. */
export function publishBlockers({ match, venue, radarEnabled, now = new Date() }) {
  const out = [];
  if (!radarEnabled) out.push("Radar está desactivado para este grupo (Grupos → Configuración).");
  if (!match || match.status !== "upcoming") out.push("Solo se pueden publicar partidos próximos.");
  else {
    const starts = matchStartsAt(match.match_date, match.start_time);
    if (!starts || starts <= now) out.push("El partido ya empezó.");
  }
  if ((match?.allowed_tags || []).length > 0) out.push("El partido está limitado a tags del grupo.");
  if (!venue || venue.lat == null || venue.lng == null) out.push("El partido necesita una sede con ubicación en el mapa.");
  return out;
}

/** Profile-like objects for Radar players so match-level lists can show "Apodo · Radar". */
export function radarProfiles(outsiders = [], groupProfiles = []) {
  const known = new Set(groupProfiles.map((p) => p.id));
  return outsiders
    .filter((o) => o && o.profile_id && !known.has(o.profile_id))
    .map((o) => ({
      id: o.profile_id,
      nickname: `${o.nickname || "Jugador"} · Radar`,
      full_name: null,
      phone: null,
      avatar_url: o.avatar_url || null,
      preferred_position: o.preferred_position || "Flexible",
      group_tags: [],
      membership_role: "radar",
      membership_is_active: true,
      is_radar: true,
    }));
}

/** Fill team members whose profile is hidden by RLS (Radar players) from the outsider list. */
export function fillTeamProfiles(teamsByMatch = {}, radarList = []) {
  if (!radarList.length) return teamsByMatch;
  const byId = new Map(radarList.map((p) => [p.id, p]));
  const out = {};
  for (const [matchId, teams] of Object.entries(teamsByMatch)) {
    out[matchId] = (teams || []).map((t) => ({
      ...t,
      team_members: (t.team_members || []).map((m) =>
        m.profiles || !m.profile_id || !byId.has(m.profile_id) ? m : { ...m, profiles: byId.get(m.profile_id) }),
    }));
  }
  return out;
}

const NOTIFICATION_TARGET = {
  radar_request_received: "admin",
  radar_spot_canceled: "admin",
  radar_request_approved: "player",
  radar_request_rejected: "player",
  radar_request_expired: "player",
  radar_match_changed: "player",
  radar_match_canceled: "player",
};

/** Where a notification leads: the admin's match (inbox) or the player's Radar requests. */
export function notificationTarget(n) {
  if (NOTIFICATION_TARGET[n?.kind] === "admin" && n.match_id) return { page: "match", matchId: n.match_id };
  return { page: "radar", tab: "mine" };
}

export function relativeTime(iso, now = new Date()) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((now - new Date(iso)) / 60000));
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
}
