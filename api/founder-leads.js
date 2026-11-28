import crypto from "node:crypto";

const MAX_BODY_BYTES = 4096;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_FREQUENCIES = new Set(["semanal", "quincenal", "mensual", "ocasional"]);
const ALLOWED_GROUP_SIZES = new Set(["5-9", "10-14", "15-22", "23+"]);
const ALLOWED_SOURCES = new Set(["landing", "features", "faq", "direct"]);

const DEFAULT_RATE_LIMIT = {
  ipWindowSeconds: 3600, // 1 hour
  maxPerIp: 5,
  emailWindowSeconds: 86400, // 24 hours
  maxPerEmail: 1,
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

export function createFounderLeadsHandler({
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
      return res.status(413).json({ error: "La solicitud excede el tamaño permitido." });
    }

    // Honeypot check: discard silently without persisting
    const honeypot = String(rawBody.hp ?? rawBody.website ?? "").trim();
    if (honeypot.length > 0) {
      return res.status(202).json({ ok: true });
    }

    // Strict input validation (ignore any admin fields like status/id/created_at)
    const contactName = typeof rawBody.contactName === "string" ? rawBody.contactName.trim() : "";
    const email = typeof rawBody.email === "string" ? rawBody.email.trim().toLowerCase() : "";
    const city = typeof rawBody.city === "string" ? rawBody.city.trim() : "";
    const groupFrequency = typeof rawBody.groupFrequency === "string" ? rawBody.groupFrequency.trim() : "";
    const groupSize = typeof rawBody.groupSize === "string" ? rawBody.groupSize.trim() : "";
    const consent = rawBody.consent === true;
    const sourceRaw = typeof rawBody.source === "string" ? rawBody.source.trim() : "landing";
    const source = ALLOWED_SOURCES.has(sourceRaw) ? sourceRaw : "landing";

    if (contactName.length < 2 || contactName.length > 120) {
      return res.status(400).json({ error: "Ingresá un nombre de contacto válido (2 a 120 caracteres)." });
    }
    if (email.length < 5 || email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Ingresá un correo electrónico válido." });
    }
    if (city.length < 2 || city.length > 120) {
      return res.status(400).json({ error: "Ingresá una ciudad válida (2 a 120 caracteres)." });
    }
    if (!ALLOWED_FREQUENCIES.has(groupFrequency)) {
      return res.status(400).json({ error: "Seleccioná una frecuencia de partidos válida." });
    }
    if (!ALLOWED_GROUP_SIZES.has(groupSize)) {
      return res.status(400).json({ error: "Seleccioná un tamaño de grupo válido." });
    }
    if (!consent) {
      return res.status(400).json({ error: "Debés aceptar el consentimiento para enviar tu solicitud." });
    }

    // Fail-closed server credentials check
    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(503).json({
        error: "El servicio de registro no está disponible temporalmente. Intentá más tarde.",
      });
    }

    const serviceHeaders = {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
    };

    const rateSalt = supabaseServiceKey.slice(0, 16);
    const ipHash = hashValue(extractClientIp(req), `lead-ip-${rateSalt}`);
    const emailHash = hashValue(email, `lead-email-${rateSalt}`);

    // Persistent atomic rate limiting: IP scope first, then email scope
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
      if (!rateRes.ok) {
        return { errorStatus: 503 };
      }
      const rows = await rateRes.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || typeof row.allowed !== "boolean") {
        return { errorStatus: 503 };
      }
      return {
        allowed: row.allowed,
        retryAfter: Math.max(1, Number(row.retry_after_sec || 60)),
      };
    }

    try {
      const ipCheck = await checkRateLimit(
        `lead_ip:${ipHash}`,
        rateLimit.maxPerIp,
        rateLimit.ipWindowSeconds,
      );
      if (ipCheck.errorStatus) {
        return res.status(503).json({ error: "Control de solicitudes temporalmente no disponible." });
      }
      if (!ipCheck.allowed) {
        if (typeof res.setHeader === "function") {
          res.setHeader("Retry-After", String(ipCheck.retryAfter));
        }
        return res.status(429).json({
          error: "Recibimos demasiadas solicitudes desde tu conexión. Intentá de nuevo más tarde.",
        });
      }

      const emailCheck = await checkRateLimit(
        `lead_email:${emailHash}`,
        rateLimit.maxPerEmail,
        rateLimit.emailWindowSeconds,
      );
      if (emailCheck.errorStatus) {
        return res.status(503).json({ error: "Control de solicitudes temporalmente no disponible." });
      }
      if (!emailCheck.allowed) {
        if (typeof res.setHeader === "function") {
          res.setHeader("Retry-After", String(emailCheck.retryAfter));
        }
        return res.status(429).json({
          error: "Ya recibimos una solicitud reciente con este correo. Te contactaremos pronto.",
        });
      }
    } catch {
      return res.status(503).json({ error: "No se pudo validar el límite de solicitudes." });
    }

    // Insert lead with server-enforced status = 'new' (never UPDATE existing rows)
    try {
      const insertRes = await fetchImpl(`${supabaseUrl}/rest/v1/founder_leads`, {
        method: "POST",
        headers: {
          ...serviceHeaders,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          contact_name: contactName,
          email,
          city,
          group_frequency: groupFrequency,
          group_size: groupSize,
          consent: true,
          source,
          status: "new",
        }),
      });

      if (!insertRes.ok) {
        return res.status(503).json({
          error: "No se pudo guardar tu solicitud en este momento. Intentá de nuevo más tarde.",
        });
      }

      // Never echo PII back in the response
      return res.status(201).json({ ok: true });
    } catch {
      return res.status(503).json({
        error: "Error temporal al registrar tu solicitud. Intentá de nuevo más tarde.",
      });
    }
  };
}

export default createFounderLeadsHandler();
