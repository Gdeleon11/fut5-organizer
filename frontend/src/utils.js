import { MATCH_STATUS_LABELS, POSITION_LABELS, ROLE_LABELS, STAR_LEVELS } from "./constants.js";

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "Jugador";
}

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function displayName(profile) {
  return profile?.nickname || profile?.full_name || "Jugador";
}

export function normalizedRating(rating) {
  const value = Number(rating);
  if (!value) return 0;
  return Math.max(1, Math.min(4, value));
}

export function ratingLabel(rating) {
  const value = normalizedRating(rating);
  return value ? `${value} estrella${value === 1 ? "" : "s"}` : "Sin estrellas";
}

export function positionLabel(position) {
  return POSITION_LABELS[position] || position || "Flexible";
}

export function statusLabel(status) {
  return MATCH_STATUS_LABELS[status] || status || "Abierto";
}

export function profileComplete(profile) {
  return Boolean(
    profile?.full_name?.trim() &&
      profile?.phone?.trim() &&
      profile?.preferred_position?.trim(),
  );
}

export function formatMatchDate(match) {
  if (!match?.match_date) return "Fecha pendiente";
  const date = new Date(`${match.match_date}T${match.start_time || "00:00"}`);
  return new Intl.DateTimeFormat("es-GT", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatMoney(amount) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GTQ",
  }).format(Number(amount || 0));
}

export function attendanceLabel(status, checkedIn = false) {
  if (checkedIn) return "Registrado";
  const labels = {
    confirmed: "Confirmado",
    canceled: "Canceló",
    no_show: "No llegó",
    checked_in: "Registrado",
    waitlist: "Lista de espera",
  };
  return labels[status] || "Sin confirmar";
}

export function fineLabel(status) {
  const labels = {
    open: "Pendiente",
    paid: "Pagada",
    forgiven: "Perdonada",
  };
  return labels[status] || status || "Pendiente";
}

export function fineReasonLabel(reason) {
  const labels = {
    no_show: "No llegó",
    late_cancel: "Canceló tarde",
    custom: "Multa especial",
    damaged_equipment: "Equipo dañado",
    late_arrival: "Llegó tarde",
    other: "Otro",
  };
  return labels[reason] || reason || "Multa";
}

export function isConfirmedAttendance(attendance) {
  return ["confirmed", "checked_in"].includes(attendance.status);
}

export function appShareUrl(match, groupId = match?.group_id) {
  const origin =
    typeof window === "undefined"
      ? "https://fut5-organizer.vercel.app"
      : window.location.origin;
  const params = new URLSearchParams();
  if (groupId) params.set("group", groupId);
  if (match?.id) params.set("match", match.id);
  return params.size > 0 ? `${origin}?${params.toString()}` : origin;
}

export function matchInvitationText(match, confirmedCount) {
  return [
    "INVITACIÓN FUT5",
    "",
    match.title || "Chamuscón",
    `Cuándo: ${formatMatchDate(match)}`,
    `Dónde: ${match.venue || "Cancha pendiente"}`,
    `Confirmados: ${confirmedCount}`,
    `Link para confirmar: ${appShareUrl(match)}`,
    "",
    "Abrí el link y confirmá si vas.",
  ].join("\n");
}

export function teamAnnouncementText(match, teams) {
  const lines = [
    "EQUIPOS FUT5",
    "",
    match.title || "Chamuscón",
    `Cuándo: ${formatMatchDate(match)}`,
    `Dónde: ${match.venue || "Cancha pendiente"}`,
    "",
  ];
  teams.forEach((team) => {
    lines.push(`${team.name} - ${team.total_rating || 0} estrellas`);
    (team.team_members || []).forEach((member) => {
      lines.push(`- ${displayName(member.profiles)}`);
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}

export function groupInvitationText(group) {
  return [
    "INVITACIÓN A CHAMUSCA",
    "",
    group?.name || "Mi chamusca",
    `Link para registrarte: ${appShareUrl(null, group?.id)}`,
    "",
    "Abrí el link, creá tu perfil y esperá que el admin te active.",
  ].join("\n");
}

export function matchReminderText(match, confirmedCount) {
  return [
    "RECORDATORIO FUT5",
    "",
    "El partido es en 1 hora",
    "",
    match.title || "Chamuscón",
    `Cuándo: ${formatMatchDate(match)}`,
    `Dónde: ${match.venue || "Cancha pendiente"}`,
    `Confirmados: ${confirmedCount}`,
    "",
    "Nos vemos ahí!",
  ].join("\n");
}

export function isFullMatch(match, attendances) {
  if (!match.max_players) return false;
  const confirmed = attendances.filter(
    (a) => a.match_id === match.id && ["confirmed", "checked_in"].includes(a.status),
  ).length;
  return confirmed >= match.max_players;
}

export function waitlistPosition(matchId, profileId, attendances) {
  const waitlisted = attendances
    .filter((a) => a.match_id === matchId && a.status === "waitlist")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const idx = waitlisted.findIndex((a) => a.profile_id === profileId);
  return idx >= 0 ? idx + 1 : null;
}

export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function teamNotificationText(match, teams) {
  const lines = [
    "TUS EQUIPOS FUT5",
    "",
    match.title || "Chamuscón",
    `Cuándo: ${formatMatchDate(match)}`,
    `Dónde: ${match.venue || "Cancha pendiente"}`,
    "",
    "---",
    "",
  ];
  teams.forEach((team) => {
    lines.push(`${team.name}:`);
    (team.team_members || []).forEach((member) => {
      lines.push(`- ${displayName(member.profiles)}`);
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}

export function playerTeamText(playerName, team, match) {
  return [
    "TU EQUIPO FUT5",
    "",
    `Hola ${playerName}!`,
    "",
    `Tu equipo: ${team.name}`,
    `Partido: ${match.title || "Chamuscón"}`,
    `Cuándo: ${formatMatchDate(match)}`,
    `Dónde: ${match.venue || "Cancha pendiente"}`,
    "",
    "Compañeros:",
    ...(team.team_members || []).map((m) => `- ${displayName(m.profiles)}`),
    "",
    "Nos vemos ahí!",
  ].join("\n");
}

export function waUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
