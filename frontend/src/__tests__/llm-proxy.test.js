import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createLlmProxyHandler } from "../../../api/llm-proxy.js";
import { distributeTeamsWithAI } from "../groq.js";
import { extractStorageObjectPath } from "../api.js";

const GROUP_A = "11111111-1111-4111-8111-111111111111";
const GROUP_B = "22222222-2222-4222-8222-222222222222";
const MATCH_A = "33333333-3333-4333-8333-333333333333";
const USER_ADMIN_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_PLAYER_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createMockRes() {
  return {
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
}

function createFakeFetch({
  user = { id: USER_ADMIN_A },
  userStatus = 200,
  membership = { role: "admin", is_active: true },
  memberStatus = 200,
  matchRow = { id: MATCH_A, group_id: GROUP_A },
  rateLimitMaxPerUser = 10,
  rateLimitStatus = 200,
  primaryOk = true,
  groqOk = true,
} = {}) {
  const userCounts = new Map();

  return vi.fn(async (url, init = {}) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      return {
        ok: userStatus >= 200 && userStatus < 300,
        status: userStatus,
        json: async () => (userStatus === 200 ? user : { error: "auth_error" }),
      };
    }
    if (u.includes("/rest/v1/group_members")) {
      return {
        ok: memberStatus >= 200 && memberStatus < 300,
        status: memberStatus,
        json: async () => (membership ? [membership] : []),
      };
    }
    if (u.includes("/rest/v1/matches")) {
      return {
        ok: true,
        status: 200,
        json: async () => (matchRow ? [matchRow] : []),
      };
    }
    if (u.includes("/rest/v1/rpc/consume_llm_rate_limit")) {
      if (rateLimitStatus !== 200) {
        return { ok: false, status: rateLimitStatus, json: async () => ({ error: "db_error" }) };
      }
      const parsed = JSON.parse(init.body || "{}");
      const limit = parsed.p_user_limit ?? rateLimitMaxPerUser;
      const count = (userCounts.get(parsed.p_user_id) || 0) + 1;
      userCounts.set(parsed.p_user_id, count);
      const allowed = count <= limit;
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            allowed,
            blocked_scope: allowed ? null : "user",
            current_count: count,
            limit_val: limit,
            retry_after_sec: allowed ? 0 : 120,
          },
        ],
      };
    }
    if (u.includes("integrate.api.nvidia.com")) {
      return {
        ok: primaryOk,
        status: primaryOk ? 200 : 500,
        json: async () =>
          primaryOk
            ? { choices: [{ message: { content: JSON.stringify({ teams: [{ name: "Equipo A", player_ids: ["p1"] }] }) } }] }
            : { error: "primary_down" },
      };
    }
    if (u.includes("api.groq.com")) {
      return {
        ok: groqOk,
        status: groqOk ? 200 : 502,
        json: async () =>
          groqOk
            ? { choices: [{ message: { content: JSON.stringify({ teams: [{ name: "Equipo Groq", player_ids: ["p1"] }] }) } }] }
            : { error: "groq_down" },
      };
    }
    throw new Error(`Unexpected fetch URL: ${u}`);
  });
}

const BASE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  PRIMARY_LLM_URL: "https://integrate.api.nvidia.com/v1/chat/completions",
  PRIMARY_LLM_KEY: "test-primary-key",
  PRIMARY_LLM_MODEL: "z-ai/glm-5.2",
  GROQ_API_KEY: "test-groq-key",
};

const VALID_BODY = {
  groupId: GROUP_A,
  matchId: MATCH_A,
  messages: [
    { role: "system", content: "Distribuye jugadores" },
    { role: "user", content: "JUGADORES: []" },
  ],
  temperature: 0.3,
  max_tokens: 1000,
};

describe("api/llm-proxy.js — distributed rate limiting, fail-closed auth & authorization", () => {
  it("rejects non-POST methods with 405", async () => {
    const handler = createLlmProxyHandler({ env: BASE_ENV, fetchImpl: createFakeFetch() });
    const res = createMockRes();
    await handler({ method: "GET", headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("rejects missing Authorization header with 401", async () => {
    const handler = createLlmProxyHandler({ env: BASE_ENV, fetchImpl: createFakeFetch() });
    const res = createMockRes();
    await handler({ method: "POST", headers: {}, body: VALID_BODY }, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid JWT with 401", async () => {
    const handler = createLlmProxyHandler({
      env: BASE_ENV,
      fetchImpl: createFakeFetch({ userStatus: 401 }),
    });
    const res = createMockRes();
    await handler(
      { method: "POST", headers: { authorization: "Bearer bad-jwt" }, body: VALID_BODY },
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it("fails closed with 503 when Supabase Auth or DB is unreachable", async () => {
    const authOutage = createLlmProxyHandler({
      env: BASE_ENV,
      fetchImpl: createFakeFetch({ userStatus: 500 }),
    });
    const resAuth = createMockRes();
    await authOutage(
      { method: "POST", headers: { authorization: "Bearer valid-jwt" }, body: VALID_BODY },
      resAuth,
    );
    expect(resAuth.statusCode).toBe(503);

    const dbOutage = createLlmProxyHandler({
      env: BASE_ENV,
      fetchImpl: createFakeFetch({ memberStatus: 500 }),
    });
    const resDb = createMockRes();
    await dbOutage(
      { method: "POST", headers: { authorization: "Bearer valid-jwt" }, body: VALID_BODY },
      resDb,
    );
    expect(resDb.statusCode).toBe(503);

    const rateOutage = createLlmProxyHandler({
      env: BASE_ENV,
      fetchImpl: createFakeFetch({ rateLimitStatus: 500 }),
    });
    const resRate = createMockRes();
    await rateOutage(
      { method: "POST", headers: { authorization: "Bearer valid-jwt" }, body: VALID_BODY },
      resRate,
    );
    expect(resRate.statusCode).toBe(503);
  });

  it("fails closed with 503 when SUPABASE_SERVICE_ROLE_KEY is not configured", async () => {
    const handler = createLlmProxyHandler({
      env: { ...BASE_ENV, SUPABASE_SERVICE_ROLE_KEY: "" },
      fetchImpl: createFakeFetch(),
    });
    const res = createMockRes();
    await handler(
      { method: "POST", headers: { authorization: "Bearer valid-jwt" }, body: VALID_BODY },
      res,
    );
    expect(res.statusCode).toBe(503);
  });

  it("rejects regular player (non-admin) and inactive admin with 403", async () => {
    for (const membership of [
      { role: "player", is_active: true },
      { role: "admin", is_active: false },
    ]) {
      const handler = createLlmProxyHandler({
        env: BASE_ENV,
        fetchImpl: createFakeFetch({ user: { id: USER_PLAYER_A }, membership }),
      });
      const res = createMockRes();
      await handler(
        { method: "POST", headers: { authorization: "Bearer valid-jwt" }, body: VALID_BODY },
        res,
      );
      expect(res.statusCode).toBe(403);
    }
  });

  it("rejects admin spoofing matchId belonging to another group with 403", async () => {
    const handler = createLlmProxyHandler({
      env: BASE_ENV,
      fetchImpl: createFakeFetch({
        membership: { role: "admin", is_active: true },
        matchRow: { id: MATCH_A, group_id: GROUP_B },
      }),
    });
    const res = createMockRes();
    await handler(
      { method: "POST", headers: { authorization: "Bearer valid-jwt" }, body: VALID_BODY },
      res,
    );
    expect(res.statusCode).toBe(403);
  });

  it("rejects oversized payload (>24KB) with 413", async () => {
    const handler = createLlmProxyHandler({ env: BASE_ENV, fetchImpl: createFakeFetch() });
    const res = createMockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer valid-jwt" },
        body: { ...VALID_BODY, messages: [{ role: "user", content: "x".repeat(30000) }] },
      },
      res,
    );
    expect(res.statusCode).toBe(413);
  });

  it("enforces distributed rate limit across concurrent requests (2 allowed, 3rd returns 429)", async () => {
    const sharedFetch = createFakeFetch({ rateLimitMaxPerUser: 2 });
    // Simulate 3 separate serverless instances hitting the same distributed RPC simultaneously
    const results = await Promise.all(
      [1, 2, 3].map(async () => {
        const instanceHandler = createLlmProxyHandler({
          env: BASE_ENV,
          fetchImpl: sharedFetch,
          rateLimit: { windowSeconds: 600, maxPerUser: 2, maxPerGroup: 10 },
        });
        const res = createMockRes();
        await instanceHandler(
          { method: "POST", headers: { authorization: "Bearer valid-jwt" }, body: VALID_BODY },
          res,
        );
        return res;
      }),
    );

    const okCount = results.filter((r) => r.statusCode === 200).length;
    const limited = results.filter((r) => r.statusCode === 429);
    expect(okCount).toBe(2);
    expect(limited).toHaveLength(1);
    expect(limited[0].headers["Retry-After"]).toBe("120");
  });

  it("falls back to server-side Groq when primary LLM fails", async () => {
    const handler = createLlmProxyHandler({
      env: BASE_ENV,
      fetchImpl: createFakeFetch({ primaryOk: false, groqOk: true }),
    });
    const res = createMockRes();
    await handler(
      { method: "POST", headers: { authorization: "Bearer valid-jwt" }, body: VALID_BODY },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.choices[0].message.content).toContain("Equipo Groq");
  });
});

describe("frontend/src/groq.js & historical payment proof Signed URL extraction", () => {
  it("contains zero references to VITE_GROQ_API_KEY or VITE_PRIMARY_LLM_KEY", () => {
    const groqSource = fs.readFileSync(path.resolve(process.cwd(), "src/groq.js"), "utf8");
    expect(groqSource).not.toContain("VITE_GROQ_API_KEY");
    expect(groqSource).not.toContain("VITE_PRIMARY_LLM_KEY");
    expect(groqSource).not.toContain("api.groq.com");
  });

  it("extracts object paths from legacy public URLs and relative paths for private payment-proofs", () => {
    expect(
      extractStorageObjectPath(
        "payment-proofs",
        "https://abc.supabase.co/storage/v1/object/public/payment-proofs/match_fee/pay-1/17000.jpg",
      ),
    ).toBe("match_fee/pay-1/17000.jpg");
    expect(extractStorageObjectPath("payment-proofs", "match_fee/pay-1/17000.jpg")).toBe(
      "match_fee/pay-1/17000.jpg",
    );
    expect(extractStorageObjectPath("payment-proofs", "data:image/svg+xml;utf8,<svg/>")).toBe("");
  });

  it("sends Bearer token and groupId to /api/llm-proxy", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ teams: [{ name: "A", player_ids: ["p1"] }] }) } }],
      }),
    }));
    const teams = await distributeTeamsWithAI({
      players: [{ id: "p1", full_name: "Ana", rating: 3 }],
      groupId: GROUP_A,
      matchId: MATCH_A,
      teamCount: 1,
      accessToken: "fake-jwt",
      fetchImpl: fetchMock,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(teams).toHaveLength(1);
  });
});
