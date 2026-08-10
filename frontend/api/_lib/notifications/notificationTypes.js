/**
 * F5Manager Notification Engine V1 — Notification Types & Payload Builders
 */

export const NOTIFICATION_TYPES = {
  MATCH_REMINDER_24H: "MATCH_REMINDER_24H",
  MATCH_REMINDER_1H: "MATCH_REMINDER_1H",
  WAITLIST_SPOT_AVAILABLE: "WAITLIST_SPOT_AVAILABLE",
  TEAMS_GENERATED: "TEAMS_GENERATED",
  MATCH_CANCELLED: "MATCH_CANCELLED",
};

export const CHANNELS = {
  PUSH: "push",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
};

/**
 * Builds a deterministic deduplication key for persistent idempotency.
 * Format: {type_slug}:{matchId}:{profileId}:{channel}
 *
 * @param {string} type - Notification type constant
 * @param {string} matchId - UUID of the match
 * @param {string} profileId - UUID of the profile
 * @param {string} [channel="push"] - Delivery channel
 * @returns {string} Unique dedupe key
 */
export function buildDedupeKey(type, matchId, profileId, channel = CHANNELS.PUSH) {
  const typeSlug = (type || "notification").toLowerCase().replace(/_/g, "-");
  return `${typeSlug}:${matchId}:${profileId}:${channel}`;
}

/**
 * Builds a standardized notification payload for Web Push delivery.
 *
 * @param {string} type - Notification type
 * @param {Object} match - Match details object
 * @param {Object} [profile] - Profile details object
 * @returns {Object} { title, body, url, tag, data }
 */
export function buildNotificationPayload(type, match = {}, profile = {}) {
  const matchTitle = match.title || match.venue || "Chamuscón";
  const venueText = match.venue ? `📍 ${match.venue}` : "Cancha reservada";
  const startTime = match.start_time || "19:00";
  const matchId = match.id || "";
  const matchUrl = matchId ? `/partidos/${matchId}` : "/partidos";

  switch (type) {
    case NOTIFICATION_TYPES.MATCH_REMINDER_24H:
      return {
        title: `⚽ Partido Mañana — ${matchTitle}`,
        body: `${venueText} · Horario: ${startTime} hrs. ¡Listos para la chamusca!`,
        url: matchUrl,
        tag: `match-24h-${matchId}`,
        data: { matchId, type },
      };

    case NOTIFICATION_TYPES.MATCH_REMINDER_1H:
      return {
        title: `⏱ Tu partido empieza pronto`,
        body: `${matchTitle} empieza en aproximadamente 1 hora. ${venueText}`,
        url: matchUrl,
        tag: `match-1h-${matchId}`,
        data: { matchId, type },
      };

    case NOTIFICATION_TYPES.WAITLIST_SPOT_AVAILABLE:
      return {
        title: `⚡ Se liberó un cupo en ${matchTitle}`,
        body: `¡Atención ${profile.full_name || "jugador"}! Podés confirmar tu asistencia ahora.`,
        url: matchUrl,
        tag: `match-waitlist-${matchId}`,
        data: { matchId, type },
      };

    default:
      return {
        title: `F5Manager — ${matchTitle}`,
        body: `Novedades sobre tu partido. ${venueText}`,
        url: matchUrl,
        tag: `match-general-${matchId}`,
        data: { matchId, type },
      };
  }
}
