/**
 * F5 Manager — Lightweight funnel analytics (Commercial Launch V1).
 *
 * Instrumenta los eventos del embudo de activación sin enviar información
 * personal (PII) a eventos analíticos:
 *
 *   landing_view → signup_start → signup_complete → group_created →
 *   first_match_created → invite_shared → first_player_confirmed →
 *   first_match_completed → founders_interest_submitted
 *
 * Diseño:
 * - Sin dependencias nuevas (no SDK de terceros).
 * - Los eventos se envían a un endpoint interno del mismo origen cuando exista;
 *   de lo contrario se registran en consola (solo desarrollo).
 * - Las propiedades se sanitizan: nunca se incluyen nombres, teléfonos ni emails.
 * - Los identificadores son técnicos y no reversibles (id interno o hash).
 */

const ENDPOINT = "/api/analytics/events";

function isPiiKey(key) {
  const pii = [
    "name", "full_name", "firstname", "lastname", "apellido", "nombre",
    "email", "correo", "mail",
    "phone", "tel", "telefono", "whatsapp",
    "address", "direccion", "document", "dni", "nit", "passport",
  ];
  const k = String(key).toLowerCase();
  return pii.some((p) => k.includes(p)) || k.endsWith("_email") || k.endsWith("_phone");
}

function sanitize(properties = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isPiiKey(key)) continue;
    if (value === null || value === undefined) continue;
    clean[key] = value;
  }
  return clean;
}

let enabled = true;

/**
 * Desactiva el envío de eventos (útil en tests o cuando no hay endpoint).
 */
function setEnabled(value) {
  enabled = Boolean(value);
}

/**
 * Registra un evento del embudo.
 * @param {string} eventName - nombre del evento (snake_case)
 * @param {Object} properties - propiedades sin PII
 */
function track(eventName, properties = {}) {
  if (!enabled) return;
  const payload = {
    event: eventName,
    properties: sanitize(properties),
    timestamp: new Date().toISOString(),
  };

  // Desarrollo: visibilidad en consola sin depender de red.
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    // eslint-disable-next-line no-console
    console.log("[f5-analytics]", payload);
  }

  // Envío ligero al endpoint propio (fire and forget). Si no existe, falla en silencio.
  if (typeof fetch === "function") {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Silencioso: la analítica no debe bloquear la experiencia.
    });
  }
}

export { track, setEnabled };
