import crypto from "node:crypto";

const MAX_BODY_BYTES = 4096;

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

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const DEDUPE_KEY_RE = /^[a-zA-Z0-9_.:-]{1,120}$/;
const EMAIL_PATTERN_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_PATTERN_RE = /\+?\d[\d\s\-()]{6,}\d/;

const DEFAULT_RATE_LIMIT = {
  windowSeconds: 600, // 10 minutes
  maxPerIp: 120,
  maxPerSession: 60,
};

function hashValue(value, salt = "") {
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

function extractClientIp(req) {
  const fwd = req.headers?.["x-forwarded-for"] || req.headers?.["X-Forwarded-For"] || "";
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  const realIp = req.headers?.["x-real-ip"] || req.headers?.["X-Real-Ip"] || "";
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeProperties(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
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

export function createAnalyticsEventsHandler({
  fetchImpl = globalThis.fetch,
  env = process.env,
  rateLimit = DEFAULT_RATE_LIMIT,
} = {}) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      if (typeof res.setHeader === "function") res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rawBody = parseJsonBody(req);
    if (!rawBody) {
      return res.status(400).json({ error: "Cuerpo JSON inválido." });
    }

    const serializedSize = Buffer.byteLength(JSON.stringify(rawBody), "utf8");
    if (serializedSize > MAX_BODY_BYTES) {
      return res.status(413).json({ error: "Payload demasiado grande." });
    }

    const eventName = typeof rawBody.event === "string" ? rawBody.event.trim() : "";
    if (!ALLOWED_EVENTS.has(eventName)) {
      return res.status(400).json({ error: "Evento no permitido." });
    }

    const sessionId = typeof rawBody.session_id === "string" ? rawBody.session_id.trim() : "";
    if (!SESSION_ID_RE.test(sessionId)) {
      return res.status(400).json({ error: "session_id inválido." });
    }

    let dedupeKey = null;
    if (rawBody.dedupe_key !== undefined && rawBody.dedupe_key !== null && rawBody.dedupe_key !== "") {
      const candidate = typeof rawBody.dedupe_key === "string" ? rawBody.dedupe_key.trim() : "";
      if (!DEDUPE_KEY_RE.test(candidate)) {
        return res.status(400).json({ error: "dedupe_key inválido." });
      }
      dedupeKey = candidate;
    }

    const properties = sanitizeProperties(rawBody.properties);

    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(503).json({ error: "Servicio de analítica no configurado." });
    }

    const serviceHeaders = {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
    };

    const rateSalt = supabaseServiceKey.slice(0, 16);
    const ipHash = hashValue(extractClientIp(req), `analytics-ip-${rateSalt}`);
    const sessionHash = hashValue(sessionId, `analytics-sess-${rateSalt}`);

    async function checkRateLimit(scopeKey, limit, windowSeconds) {
      const rateRes = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/consume_public_rate_limit`, {
        method: "POST",
        headers: serviceHeaders,
        body: JSON.stringify({
          p_scope_key: scopeKey,
          p_limit: limit,
          p_window_seconds: windowSeconds,
        }),
      });
      if (!rateRes.ok) return { errorStatus: 503 };
      const rows = await rateRes.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || typeof row.allowed !== "boolean") return { errorStatus: 503 };
      return {
        allowed: row.allowed,
        retryAfter: Math.max(1, Number(row.retry_after_sec || 60)),
      };
    }

    try {
      const ipCheck = await checkRateLimit(
        `analytics_ip:${ipHash}`,
        rateLimit.maxPerIp,
        rateLimit.windowSeconds,
      );
      if (ipCheck.errorStatus) {
        return res.status(503).json({ error: "Control de cuotas temporalmente no disponible." });
      }
      if (!ipCheck.allowed) {
        if (typeof res.setHeader === "function") {
          res.setHeader("Retry-After", String(ipCheck.retryAfter));
        }
        return res.status(429).json({ error: "Límite de eventos excedido." });
      }

      const sessCheck = await checkRateLimit(
        `analytics_sess:${sessionHash}`,
        rateLimit.maxPerSession,
        rateLimit.windowSeconds,
      );
      if (sessCheck.errorStatus) {
        return res.status(503).json({ error: "Control de cuotas temporalmente no disponible." });
      }
      if (!sessCheck.allowed) {
        if (typeof res.setHeader === "function") {
          res.setHeader("Retry-After", String(sessCheck.retryAfter));
        }
        return res.status(429).json({ error: "Límite de eventos por sesión excedido." });
      }
    } catch {
      return res.status(503).json({ error: "Error validando límites de analítica." });
    }

    // Persist event. All client-submitted events are explicitly marked
    // trust_level = 'client_reported' (never authoritative business proof).
    try {
      const insertRes = await fetchImpl(`${supabaseUrl}/rest/v1/analytics_events`, {
        method: "POST",
        headers: {
          ...serviceHeaders,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          event_name: eventName,
          session_id: sessionId,
          dedupe_key: dedupeKey,
          properties,
          trust_level: "client_reported",
        }),
      });

      if (insertRes.status === 409) {
        return res.status(200).json({ ok: true, deduplicated: true });
      }

      if (!insertRes.ok) {
        return res.status(503).json({ error: "No se pudo almacenar el evento." });
      }

      return res.status(201).json({ ok: true, stored: true });
    } catch {
      return res.status(503).json({ error: "Error temporal al registrar analítica." });
    }
  };
}

export default createAnalyticsEventsHandler();
