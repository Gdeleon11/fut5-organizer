/**
 * F5 Manager — Lightweight funnel analytics (Commercial Launch V1).
 *
 * Instrumenta los nueve eventos del embudo de activación sin enviar PII:
 *   landing_view → signup_start → signup_complete → group_created →
 *   first_match_created → invite_shared → first_player_confirmed →
 *   first_match_completed → founders_interest_submitted
 */

const ENDPOINT = "/api/analytics/events";
const SESSION_STORAGE_KEY = "f5_analytics_session_id";
const SESSION_DEDUPE_PREFIX = "f5_ev_sess:";
const MILESTONE_DEDUPE_PREFIX = "f5_ev_mile:";

const ALLOWED_EVENTS = new Set([
  "landing_view",
  "signup_start",
  "signup_complete",
  "group_created",
  "first_match_created",
  "invite_shared",
  "first_player_confirmed",
  "first_match_completed",
  "founders_interest_submitted",
]);

const ALLOWED_PROPERTY_KEYS = new Set([
  "page",
  "source",
  "channel",
  "step",
  "city",
  "group_frequency",
  "group_size",
  "has_invite",
  "mode",
]);

const EMAIL_PATTERN_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_PATTERN_RE = /\+?\d[\d\s\-()]{6,}\d/;

let enabled = true;
let memorySessionId = null;
const memoryDedupe = new Set();

function generateSessionId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    // fallback below
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function getSessionId() {
  if (typeof window !== "undefined") {
    try {
      const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
        return existing;
      }
      const created = generateSessionId();
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
      return created;
    } catch {
      // sessionStorage unavailable
    }
  }
  if (!memorySessionId) {
    memorySessionId = generateSessionId();
  }
  return memorySessionId;
}

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
    if (isPiiKey(key) || !ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean" || typeof value === "number") {
      if (typeof value === "number" && !Number.isFinite(value)) continue;
      clean[key] = value;
    } else if (typeof value === "string") {
      const trimmed = value.trim().slice(0, 80);
      if (!trimmed) continue;
      if (EMAIL_PATTERN_RE.test(trimmed) || PHONE_PATTERN_RE.test(trimmed)) continue;
      clean[key] = trimmed;
    }
  }
  return clean;
}

function hasFiredLocally(storage, key) {
  if (memoryDedupe.has(key)) return true;
  if (!storage) return false;
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markFiredLocally(storage, key) {
  memoryDedupe.add(key);
  if (!storage) return;
  try {
    storage.setItem(key, "1");
  } catch {
    // ignore storage quota errors
  }
}

function setEnabled(value) {
  enabled = Boolean(value);
}

function resetAnalyticsState() {
  memoryDedupe.clear();
  memorySessionId = null;
  if (typeof window !== "undefined") {
    try {
      for (const storage of [window.sessionStorage, window.localStorage]) {
        const toRemove = [];
        for (let i = 0; i < storage.length; i += 1) {
          const k = storage.key(i);
          if (k && (k === SESSION_STORAGE_KEY || k.startsWith(SESSION_DEDUPE_PREFIX) || k.startsWith(MILESTONE_DEDUPE_PREFIX))) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => storage.removeItem(k));
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Registra un evento del embudo.
 * @param {string} eventName - nombre del evento (lista blanca)
 * @param {Object} properties - propiedades sin PII
 * @param {Object} options - { dedupe?: "session" | "milestone" | string }
 */
function track(eventName, properties = {}, options = {}) {
  if (!enabled) return false;
  if (!ALLOWED_EVENTS.has(eventName)) return false;

  const sessionId = getSessionId();
  const dedupeMode = options?.dedupe || null;
  let dedupeKey = null;

  if (dedupeMode === "session") {
    const localKey = `${SESSION_DEDUPE_PREFIX}${eventName}`;
    const storage = typeof window !== "undefined" ? window.sessionStorage : null;
    if (hasFiredLocally(storage, localKey)) return false;
    markFiredLocally(storage, localKey);
    dedupeKey = `sess:${sessionId}`;
  } else if (dedupeMode === "milestone") {
    const localKey = `${MILESTONE_DEDUPE_PREFIX}${eventName}`;
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    if (hasFiredLocally(storage, localKey)) return false;
    markFiredLocally(storage, localKey);
    dedupeKey = `mile:${sessionId}`;
  } else if (typeof dedupeMode === "string" && dedupeMode.trim()) {
    const safeSuffix = dedupeMode.trim().replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 64);
    if (safeSuffix) {
      const localKey = `${MILESTONE_DEDUPE_PREFIX}${eventName}:${safeSuffix}`;
      const storage = typeof window !== "undefined" ? window.localStorage : null;
      if (hasFiredLocally(storage, localKey)) return false;
      markFiredLocally(storage, localKey);
      dedupeKey = `key:${safeSuffix}`;
    }
  }

  const payload = {
    event: eventName,
    session_id: sessionId,
    ...(dedupeKey ? { dedupe_key: dedupeKey } : {}),
    properties: sanitize(properties),
  };

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    // eslint-disable-next-line no-console
    console.log("[f5-analytics]", payload);
  }

  if (typeof fetch === "function") {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // No bloquear la UX por fallos de red en analítica.
    });
  }

  return true;
}

export { track, setEnabled, resetAnalyticsState, ALLOWED_EVENTS };
