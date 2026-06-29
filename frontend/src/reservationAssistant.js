import { displayName, formatMatchDate } from "./utils.js";

export const canUseReservationAssistant = true;

export const RESERVATION_STATUSES = ["pending", "confirmed", "failed"];

export function reservationStatusLabel(status) {
  const labels = {
    none: "Sin reserva",
    pending: "Pendiente",
    confirmed: "Confirmada",
    failed: "Fallida",
  };
  return labels[status] || labels.pending;
}

export function activeReservationStatus(match) {
  if (!match?.requires_reservation) return "none";
  return match.reservation_status && match.reservation_status !== "none"
    ? match.reservation_status
    : "pending";
}

export function formatPreferredDates(dates = []) {
  if (!dates.length) return "por definir";
  return dates
    .map((date) => new Date(`${date}T12:00:00`).toLocaleDateString("es-GT", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }))
    .join(", ");
}

export function confirmedPlayersForMatch(match, attendances = [], profiles = []) {
  const profileById = new Map((profiles || []).map((profile) => profile && [profile.id, profile]).filter(Boolean));
  return (attendances || [])
    .filter((attendance) => attendance && match && attendance.match_id === match.id)
    .filter((attendance) => ["confirmed", "checked_in"].includes(attendance.status))
    .map((attendance) => profileById.get(attendance.profile_id))
    .filter(Boolean);
}

export function generateReservationText({ match, attendances = [], profiles = [] }) {
  const responsible = (profiles || []).find((profile) => profile && match && profile.id === match.reservation_owner_user_id);
  const confirmedPlayers = confirmedPlayersForMatch(match, attendances, profiles);
  const names = confirmedPlayers.map(displayName).join(", ") || "sin jugadores confirmados todavía";
  const venue = match?.venue ? `\nSede/cancha: ${match.venue}.` : "";
  const dateText = match && (match.preferred_dates || []).length
    ? formatPreferredDates(match.preferred_dates)
    : (match?.match_date ? formatMatchDate(match) : "por definir");
  const timeText = match?.preferred_time_range || match?.start_time || "por definir";

  return [
    `Hola, solicito reserva para el partido ${match?.title || "Chamuscón"}.`,
    venue,
    `Fechas sugeridas: ${dateText}.`,
    `Horario sugerido: ${timeText}.`,
    `Responsable: ${responsible ? displayName(responsible) : "por definir"}.`,
    `Jugadores confirmados (${confirmedPlayers.length}): ${names}.`,
    match?.reservation_notes ? `Notas: ${match.reservation_notes}.` : "",
  ].filter(Boolean).join("\n");
}
