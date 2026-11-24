/* In-browser mock of the Supabase REST/Auth endpoints the signed-in boot uses, so Playwright can
 * exercise login → reload → direct links without a real database. Requests never leave the test:
 * the app is built with VITE_SUPABASE_URL=http://supabase.mock.test (see playwright.config.js). */
export const MOCK_SUPABASE_ORIGIN = "http://supabase.mock.test";

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export function createMockDb({ design = "editorial" } = {}) {
  const user = {
    id: "11111111-1111-4111-8111-111111111111", email: "jugador@example.test",
    user_metadata: { f5_appearance: { design, palette: "neon", updatedAt: 1 } },
  };
  const group = { id: "22222222-2222-4222-8222-222222222222", name: "Jueves Mock", owner_id: "99999999-9999-4999-8999-999999999999" };
  const profile = {
    id: user.id, full_name: "Jugador Mock", nickname: "Mock", phone: "5555-0000",
    preferred_position: "Midfielder", avatar_url: null, group_tags: [], is_active: true,
  };
  const db = {
    user,
    group,
    profiles: [profile],
    group_members: [{ id: "gm-1", group_id: group.id, profile_id: user.id, role: "player", is_active: true, created_at: "2026-01-01T00:00:00Z", groups: group, profiles: profile }],
    matches: [
      { id: "33333333-3333-4333-8333-333333333333", group_id: group.id, title: "Jueves de fútbol", venue: "Domo Mock", status: "upcoming", max_players: 10, court_cost: 0, match_date: day(3), start_time: "19:00", allowed_tags: [] },
      { id: "44444444-4444-4444-8444-444444444444", group_id: group.id, title: "Sábado temprano", venue: "Cancha Norte", status: "upcoming", max_players: 10, court_cost: 0, match_date: day(5), start_time: "08:00", allowed_tags: [] },
    ],
    attendances: [
      { id: "att-other-1", match_id: "44444444-4444-4444-8444-444444444444", profile_id: "55555555-5555-4555-8555-555555555555", status: "confirmed", checked_in: false, created_at: "2026-01-01T00:00:00Z" },
    ],
    settings: [{ group_id: group.id, fine_amount: 50, late_cancel_fine_amount: 25 }],
    failNext: {}, // table → number of requests to fail with 500
    writes: [],
  };
  return db;
}

function jwt(sub) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.mock`;
}

function filterRows(rows, url) {
  let out = rows;
  for (const [key, value] of url.searchParams.entries()) {
    if (key.includes(".")) continue;
    const m = /^eq\.(.*)$/.exec(value);
    if (m) { out = out.filter((r) => String(r[key]) === m[1]); continue; }
    const inList = /^in\.\((.*)\)$/.exec(value);
    if (inList) {
      const vals = inList[1].split(",").map((v) => v.replace(/^"|"$/g, ""));
      out = out.filter((r) => vals.includes(String(r[key])));
    }
  }
  return out;
}

/** Routes every request to the mock origin. Returns the db so tests can inspect writes. */
export async function mockSupabase(context, db = createMockDb()) {
  await context.route(`${MOCK_SUPABASE_ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.startsWith("/auth/v1/token") && db.authError) {
      return json({ error: "invalid_grant", error_description: db.authError, msg: db.authError, code: 400 }, 400);
    }
    if (url.pathname.startsWith("/auth/v1/recover")) { db.recoverRequests = (db.recoverRequests || 0) + 1; return json({}); }
    if (url.pathname.startsWith("/auth/v1/token")) {
      return json({ access_token: jwt(db.user.id), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "mock-refresh", user: { ...db.user, aud: "authenticated", role: "authenticated" } });
    }
    if (url.pathname.startsWith("/auth/v1/user")) return json({ ...db.user, aud: "authenticated", role: "authenticated" });
    if (url.pathname.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204, body: "" });
    if (url.pathname.startsWith("/storage/")) return json({ error: "not found" }, 404);

    const rpc = /^\/rest\/v1\/rpc\/(.+)$/.exec(url.pathname);
    if (rpc) {
      const args = req.postDataJSON?.() ?? null;
      db.rpcs = db.rpcs || [];
      db.rpcs.push({ fn: rpc[1], args });
      if (rpc[1] === "notifications_unread_count") return json(0);
      if (rpc[1] === "search_groups_public" && db.publicGroupsError) return json({ message: "Autenticación requerida.", code: "P0001" }, 400);
      if (rpc[1] === "search_groups_public") return json((db.publicGroups || []).filter((g) => g.id === args?.p_query || g.name.toLowerCase().includes(String(args?.p_query || "").toLowerCase())));
      if (rpc[1] === "postmatch_summary" && db.postmatchSummary) return json(db.postmatchSummary);
      if (rpc[1] === "radar_set_group_settings") {
        const row = { group_id: args.p_group_id, enabled: args.p_enabled, show_group_name: args.p_show_group_name };
        db.radar_group_settings = [row];
        return json(row);
      }
      return json([]);
    }

    const table = /^\/rest\/v1\/([^/?]+)/.exec(url.pathname)?.[1];
    if (!table) return json({}, 404);
    if (db.failNext[table] > 0) {
      db.failNext[table] -= 1;
      return json({ message: "Servicio no disponible (mock)", code: "PGRST000" }, 503);
    }
    const method = req.method();
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");

    if (method === "GET" || method === "HEAD") {
      const rows = filterRows(db[table] || [], url);
      if (single) return rows[0] ? json(rows[0]) : json({ message: "no rows", code: "PGRST116" }, 406);
      return json(rows);
    }
    const body = req.postDataJSON?.() ?? null;
    db.writes.push({ table, method, body, query: url.search });
    if (method === "POST") {
      const items = (Array.isArray(body) ? body : [body]).map((b, i) => ({ id: `${table}-${db.writes.length}-${i}`, created_at: new Date().toISOString(), ...b }));
      const conflict = url.searchParams.get("on_conflict");
      db[table] = db[table] || [];
      for (const item of items) {
        const keys = conflict ? conflict.split(",") : [];
        const idx = keys.length ? db[table].findIndex((r) => keys.every((k) => String(r[k]) === String(item[k]))) : -1;
        if (idx >= 0) db[table][idx] = { ...db[table][idx], ...item }; else db[table].push(item);
      }
      return json(single ? items[0] : items, 201);
    }
    if (method === "PATCH") {
      const rows = filterRows(db[table] || [], url);
      rows.forEach((r) => Object.assign(r, body));
      return json(single ? rows[0] || {} : rows);
    }
    if (method === "DELETE") {
      const gone = new Set(filterRows(db[table] || [], url));
      db[table] = (db[table] || []).filter((r) => !gone.has(r));
      return json([]);
    }
    return json([]);
  });
  return db;
}
