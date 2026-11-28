import { describe, expect, it, vi } from "vitest";
import { createFounderLeadsHandler } from "../../../api/founder-leads.js";
import { createAnalyticsEventsHandler } from "../../../api/analytics/events.js";

const BASE_ENV = {
  SUPABASE_URL: "https://staging.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-1234567890",
};

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("POST /api/founder-leads", () => {
  const validBody = {
    contactName: "Carlos Organizador",
    email: "carlos@chamusca.gt",
    city: "Guatemala",
    groupFrequency: "semanal",
    groupSize: "10-14",
    consent: true,
    source: "landing",
    status: "onboarded", // intento de inyección administrativa
  };

  it("rechaza métodos distintos de POST con 405", async () => {
    const handler = createFounderLeadsHandler({ env: BASE_ENV, fetchImpl: vi.fn() });
    const res = makeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("descarta honeypot con 202 sin llamar a Supabase", async () => {
    const fetchImpl = vi.fn();
    const handler = createFounderLeadsHandler({ env: BASE_ENV, fetchImpl });
    const res = makeRes();
    await handler(
      { method: "POST", headers: {}, body: { ...validBody, hp: "http://spam.bot" } },
      res,
    );
    expect(res.statusCode).toBe(202);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rechaza falta de consentimiento y correo inválido con 400", async () => {
    const fetchImpl = vi.fn();
    const handler = createFounderLeadsHandler({ env: BASE_ENV, fetchImpl });

    const res1 = makeRes();
    await handler({ method: "POST", headers: {}, body: { ...validBody, consent: false } }, res1);
    expect(res1.statusCode).toBe(400);

    const res2 = makeRes();
    await handler({ method: "POST", headers: {}, body: { ...validBody, email: "no-es-correo" } }, res2);
    expect(res2.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("inserta lead válido forzando status='new' y sin retornar PII", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes("/rpc/consume_public_rate_limit")) {
        return { ok: true, status: 200, json: async () => [{ allowed: true, retry_after_sec: 0 }] };
      }
      return { ok: true, status: 201, json: async () => [] };
    });

    const handler = createFounderLeadsHandler({ env: BASE_ENV, fetchImpl });
    const res = makeRes();
    await handler(
      { method: "POST", headers: { "x-forwarded-for": "190.1.2.3" }, body: validBody },
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(JSON.stringify(res.body)).not.toContain("carlos@chamusca.gt");

    const insertCall = fetchImpl.mock.calls.find(([u]) => u.endsWith("/rest/v1/founder_leads"));
    expect(insertCall).toBeTruthy();
    const inserted = JSON.parse(insertCall[1].body);
    expect(inserted.status).toBe("new");
    expect(inserted.consent).toBe(true);
  });

  it("retorna 429 cuando el rate limit persistente bloquea", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ allowed: false, retry_after_sec: 120 }],
    }));

    const handler = createFounderLeadsHandler({ env: BASE_ENV, fetchImpl });
    const res = makeRes();
    await handler({ method: "POST", headers: {}, body: validBody }, res);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("120");
  });

  it("falla cerrado con 503 si falta SUPABASE_SERVICE_ROLE_KEY", async () => {
    const handler = createFounderLeadsHandler({
      env: { SUPABASE_URL: BASE_ENV.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: "" },
      fetchImpl: vi.fn(),
    });
    const res = makeRes();
    await handler({ method: "POST", headers: {}, body: validBody }, res);
    expect(res.statusCode).toBe(503);
  });
});

describe("POST /api/analytics/events", () => {
  const validEvent = {
    event: "landing_view",
    session_id: "sess_1234567890",
    dedupe_key: "sess:sess_1234567890",
    properties: {
      page: "/",
      email: "leak@test.com",
      source: "5555-9999",
      unknown_key: "ignored",
    },
  };

  it("rechaza eventos fuera de lista blanca con 400", async () => {
    const handler = createAnalyticsEventsHandler({ env: BASE_ENV, fetchImpl: vi.fn() });
    const res = makeRes();
    await handler(
      { method: "POST", headers: {}, body: { ...validEvent, event: "paid_subscription" } },
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("persiste evento sanitizado con trust_level='client_reported' y maneja deduplicación 409→200", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes("/rpc/consume_public_rate_limit")) {
        return { ok: true, status: 200, json: async () => [{ allowed: true, retry_after_sec: 0 }] };
      }
      return { ok: true, status: 201, json: async () => [] };
    });

    const handler = createAnalyticsEventsHandler({ env: BASE_ENV, fetchImpl });
    const res1 = makeRes();
    await handler({ method: "POST", headers: {}, body: validEvent }, res1);
    expect(res1.statusCode).toBe(201);
    expect(res1.body).toEqual({ ok: true, stored: true });

    const insertCall = fetchImpl.mock.calls.find(([u]) => u.endsWith("/rest/v1/analytics_events"));
    const inserted = JSON.parse(insertCall[1].body);
    expect(inserted.trust_level).toBe("client_reported");
    expect(inserted.properties).toEqual({ page: "/" });

    // Simulate duplicate 409 from unique partial index
    fetchImpl.mockImplementation(async (url) => {
      if (url.includes("/rpc/consume_public_rate_limit")) {
        return { ok: true, status: 200, json: async () => [{ allowed: true, retry_after_sec: 0 }] };
      }
      return { ok: false, status: 409, json: async () => ({ code: "23505" }) };
    });
    const res2 = makeRes();
    await handler({ method: "POST", headers: {}, body: validEvent }, res2);
    expect(res2.statusCode).toBe(200);
    expect(res2.body).toEqual({ ok: true, deduplicated: true });
  });
});
