const DEFAULT_PRIMARY_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_PRIMARY_MODEL = "z-ai/glm-5.2";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_BYTES = 24 * 1024;
const MAX_MESSAGES = 4;
const MAX_TOTAL_CONTENT_CHARS = 16000;
const MAX_TOKENS_CAP = 2048;

const DEFAULT_RATE_LIMIT = {
  windowSeconds: 600, // 10 minutes
  maxPerUser: 10,
  maxPerGroup: 25,
};

function sanitizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return { error: "Se requieren entre 1 y 4 mensajes válidos." };
  }

  let totalChars = 0;
  const sanitized = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      return { error: "Formato de mensaje inválido." };
    }
    const role = msg.role;
    const content = typeof msg.content === "string" ? msg.content : "";
    if (!["system", "user"].includes(role) || !content.trim()) {
      return { error: "Rol o contenido de mensaje inválido." };
    }
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CONTENT_CHARS) {
      return { error: "El tamaño del prompt excede el límite permitido.", status: 413 };
    }
    sanitized.push({ role, content });
  }

  return { messages: sanitized };
}

export function createLlmProxyHandler({
  fetchImpl = globalThis.fetch,
  env = process.env,
  rateLimit = DEFAULT_RATE_LIMIT,
} = {}) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 1. Validate payload size before parsing/using
    const rawBody = req.body && typeof req.body === "object" ? req.body : null;
    if (!rawBody) {
      return res.status(400).json({ error: "Cuerpo JSON inválido." });
    }

    const serializedSize = Buffer.byteLength(JSON.stringify(rawBody), "utf8");
    if (serializedSize > MAX_BODY_BYTES) {
      return res.status(413).json({ error: "Payload demasiado grande." });
    }

    // 2. Require Bearer JWT
    const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
    const tokenMatch = String(authHeader).match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1]?.trim();
    if (!accessToken) {
      return res.status(401).json({ error: "Autenticación requerida." });
    }

    // 3. Validate groupId (and optional matchId)
    const groupId = typeof rawBody.groupId === "string" ? rawBody.groupId.trim() : "";
    const matchId = typeof rawBody.matchId === "string" ? rawBody.matchId.trim() : "";
    if (!UUID_RE.test(groupId)) {
      return res.status(400).json({ error: "groupId válido es requerido." });
    }
    if (matchId && !UUID_RE.test(matchId)) {
      return res.status(400).json({ error: "matchId inválido." });
    }

    const msgCheck = sanitizeMessages(rawBody.messages);
    if (msgCheck.error) {
      return res.status(msgCheck.status || 400).json({ error: msgCheck.error });
    }

    // 4. Fail-closed verification of server-side Supabase credentials
    //    Service role key is required for authoritative role lookup & distributed rate limiting.
    const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(503).json({
        error: "Servicio de autorización o cuotas no configurado en el servidor.",
      });
    }

    const serviceHeaders = {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
    };

    // 5. Verify JWT against Supabase Auth (fail-closed)
    let user;
    try {
      const userRes = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (userRes.status === 401 || userRes.status === 403) {
        return res.status(401).json({ error: "Sesión inválida o expirada." });
      }
      if (!userRes.ok) {
        return res.status(503).json({ error: "Servicio de autenticación temporalmente no disponible." });
      }
      user = await userRes.json();
      if (!user?.id || !UUID_RE.test(user.id)) {
        return res.status(401).json({ error: "Usuario no autenticado." });
      }
    } catch {
      return res.status(503).json({ error: "No se pudo verificar la sesión en el servidor." });
    }

    // 6. Server-side group membership & admin role verification (fail-closed)
    try {
      const memberUrl =
        `${supabaseUrl}/rest/v1/group_members?group_id=eq.${encodeURIComponent(groupId)}` +
        `&profile_id=eq.${encodeURIComponent(user.id)}&select=role,is_active&limit=1`;
      const memberRes = await fetchImpl(memberUrl, {
        method: "GET",
        headers: serviceHeaders,
      });

      if (!memberRes.ok) {
        return res.status(503).json({ error: "No se pudieron verificar los permisos del grupo." });
      }

      const members = await memberRes.json();
      const membership = Array.isArray(members) ? members[0] : null;
      const isAuthorizedAdmin =
        Boolean(membership) &&
        membership.is_active === true &&
        ["admin", "super_admin"].includes(membership.role);

      if (!isAuthorizedAdmin) {
        return res.status(403).json({ error: "Solo administradores activos del grupo pueden usar la IA." });
      }

      if (matchId) {
        const matchUrl =
          `${supabaseUrl}/rest/v1/matches?id=eq.${encodeURIComponent(matchId)}&select=id,group_id&limit=1`;
        const matchRes = await fetchImpl(matchUrl, {
          method: "GET",
          headers: serviceHeaders,
        });
        if (!matchRes.ok) {
          return res.status(503).json({ error: "No se pudo validar el partido." });
        }
        const matchRows = await matchRes.json();
        const matchRow = Array.isArray(matchRows) ? matchRows[0] : null;
        if (!matchRow || matchRow.group_id !== groupId) {
          return res.status(403).json({ error: "El partido no pertenece al grupo autorizado." });
        }
      }
    } catch {
      return res.status(503).json({ error: "Error verificando autorización en la base de datos." });
    }

    // 7. Distributed atomic rate limiting via PostgreSQL RPC (fail-closed on DB error)
    try {
      const rateRes = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/consume_llm_rate_limit`, {
        method: "POST",
        headers: {
          ...serviceHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_user_id: user.id,
          p_group_id: groupId,
          p_user_limit: rateLimit.maxPerUser,
          p_group_limit: rateLimit.maxPerGroup,
          p_window_seconds: rateLimit.windowSeconds,
        }),
      });

      if (!rateRes.ok) {
        return res.status(503).json({
          error: "Control de cuotas temporalmente no disponible. Usa el balanceador heurístico.",
        });
      }

      const rateRows = await rateRes.json();
      const rateRow = Array.isArray(rateRows) ? rateRows[0] : rateRows;
      if (!rateRow || typeof rateRow.allowed !== "boolean") {
        return res.status(503).json({ error: "Respuesta inválida del control de cuotas." });
      }

      if (!rateRow.allowed) {
        const retrySec = Math.max(1, Number(rateRow.retry_after_sec || 60));
        if (typeof res.setHeader === "function") {
          res.setHeader("Retry-After", String(retrySec));
        }
        const message =
          rateRow.blocked_scope === "group"
            ? "El grupo alcanzó el límite temporal de solicitudes de IA."
            : "Demasiadas solicitudes de IA. Intenta de nuevo en unos minutos o usa el balanceador heurístico.";
        return res.status(429).json({ error: message });
      }
    } catch {
      return res.status(503).json({
        error: "No se pudo validar el límite de consumo. Usa el balanceador heurístico.",
      });
    }

    // 8. Build bounded upstream LLM payload (server-only env vars)
    const rawTemp = Number(rawBody.temperature);
    const temperature = Number.isFinite(rawTemp) ? Math.max(0, Math.min(1, rawTemp)) : 0.3;
    const rawMaxTokens = Number(rawBody.max_tokens);
    const maxTokens = Number.isFinite(rawMaxTokens)
      ? Math.max(64, Math.min(MAX_TOKENS_CAP, Math.round(rawMaxTokens)))
      : 1500;
    const wantJsonMode = rawBody.json_mode !== false;

    const primaryUrl = env.PRIMARY_LLM_URL || DEFAULT_PRIMARY_URL;
    const primaryKey = env.PRIMARY_LLM_KEY || "";
    const primaryModel = env.PRIMARY_LLM_MODEL || DEFAULT_PRIMARY_MODEL;
    const groqKey = env.GROQ_API_KEY || "";
    const groqModel = env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

    if (!primaryKey && !groqKey) {
      return res.status(503).json({
        error: "Servicio de IA no configurado en el servidor. Usa el balanceador heurístico.",
      });
    }

    async function callProvider(url, apiKey, model, jsonMode) {
      const payload = {
        model,
        messages: msgCheck.messages,
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      };
      const upstream = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await upstream.json().catch(() => ({}));
      return { ok: upstream.ok, status: upstream.status, data };
    }

    try {
      if (primaryKey) {
        let primaryResult = await callProvider(primaryUrl, primaryKey, primaryModel, wantJsonMode);
        if (!primaryResult.ok && wantJsonMode) {
          primaryResult = await callProvider(primaryUrl, primaryKey, primaryModel, false);
        }
        if (primaryResult.ok) {
          return res.status(200).json(primaryResult.data);
        }
      }

      if (groqKey) {
        const groqResult = await callProvider(GROQ_API_URL, groqKey, groqModel, wantJsonMode);
        if (groqResult.ok) {
          return res.status(200).json(groqResult.data);
        }
        return res.status(502).json({ error: "El proveedor de IA no pudo completar la solicitud." });
      }

      return res.status(502).json({ error: "El proveedor de IA no está disponible en este momento." });
    } catch {
      return res.status(502).json({ error: "Error de conexión con el servicio de IA." });
    }
  };
}

export default createLlmProxyHandler();
