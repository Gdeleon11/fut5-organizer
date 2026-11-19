/* Cross-device appearance validation against Chamusca-Staging (synthetic accounts only). */
const { chromium, devices } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@playwright/test");
const { createClient } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const env = Object.fromEntries(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const U = JSON.parse(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg_users.json", "utf8"));
const REF = "ylynjvssjlmhzgmhkrsd";
const PROD = "iijrkeshjpjmxdsclnmo";
if (!env.STG_URL.includes(REF)) throw new Error("not staging");
const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const admin = createClient(env.STG_URL, env.STG_SERVICE, { auth: { persistSession: false } });

const results = [];
const evidence = { prodRequests: [], consoleErrors: [], authCalls: {} };
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${id}] ${name}${detail ? " — " + JSON.stringify(detail) : ""}`);
}
async function metaOf(id) {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error) throw error;
  return data.user.user_metadata;
}
async function login(email, password) {
  const c = createClient(env.STG_URL, env.STG_ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}
async function device(browser, label, mobile) {
  const ctx = await browser.newContext(mobile ? { ...devices["Pixel 7"] } : { viewport: { width: 1440, height: 900 } });
  ctx.label = label;
  evidence.authCalls[label] = [];
  await ctx.route(`**/*${PROD}*/**`, (route) => {
    evidence.prodRequests.push(route.request().url());
    return route.abort();
  });
  ctx.on("request", (req) => {
    const u = req.url();
    if (u.includes("/auth/v1/")) evidence.authCalls[label].push({ t: Date.now(), m: req.method(), p: new URL(u).pathname });
  });
  ctx.on("console", (msg) => { if (msg.type() === "error") evidence.consoleErrors.push(`${label}: ${msg.text().slice(0, 200)}`); });
  return ctx;
}
async function signInContext(ctx, who) {
  const session = await login(U[who].email, U[who].password);
  await ctx.addInitScript(({ key, value }) => {
    if (!sessionStorage.getItem("__qa_injected")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("__qa_injected", "1");
    }
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
  // also set immediately for already-open pages
  return session;
}
async function open(ctx, page) {
  page = page || (await ctx.newPage());
  await page.goto(`${BASE}/partidos`);
  await page.waitForSelector("[data-design]", { timeout: 30000 });
  await page.waitForTimeout(1200); // allow getUser() + reconcile
  return page;
}
async function current(page) {
  return page.evaluate(() => ({
    design: document.documentElement.getAttribute("data-f5-design"),
    palette: document.documentElement.getAttribute("data-f5-palette"),
    view: document.querySelector("[data-design]")?.getAttribute("data-design"),
    local: JSON.parse(localStorage.getItem("f5_appearance_v1") || "null"),
  }));
}
async function openProfile(page) {
  const direct = page.locator("button:visible").filter({ hasText: /^Mi FIFA$/ }).first();
  if (await direct.count()) await direct.click();
  else {
    await page.locator('button[title="Más opciones"]:visible').first().click();
    await page.locator("button:visible").filter({ hasText: /^Mi FIFA$/ }).first().click();
  }
  await page.locator("#apariencia").waitFor();
  await page.locator("#apariencia").scrollIntoViewIfNeeded();
}
async function choose(page, design, palette) {
  await openProfile(page);
  if (design) await page.locator("label.md-design-opt", { hasText: design }).click();
  if (palette) await page.locator("label.md-palette-opt", { hasText: palette }).click();
}
async function waitSync(page, re = /Guardado en tu cuenta/) {
  await page.locator(".md-sync").filter({ hasText: re }).waitFor({ timeout: 10000 });
  return page.locator(".md-sync").innerText();
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });

(async () => {
  const browser = await chromium.launch();
  const A = U.A.id, B = U.B.id;

  // Baseline: A has no preference stored yet.
  const baseA = await metaOf(A);
  check("0", "Cuenta sintética A sin preferencia previa en Auth", !baseA.f5_appearance, { keys: Object.keys(baseA) });

  // 1–2. Same account, two independent contexts (desktop + mobile)
  const desk = await device(browser, "desktop", false);
  const mob = await device(browser, "mobile", true);
  await signInContext(desk, "A");
  await signInContext(mob, "A");
  const dp = await open(desk);
  const mp = await open(mob);
  const d0 = await current(dp), m0 = await current(mp);
  check("1-2", "Sesión de A abierta en escritorio y móvil; sin preferencia ⇒ valor predeterminado", d0.design === "editorial" && d0.palette === "neon" && m0.design === "editorial" && m0.palette === "neon", { desktop: d0, mobile: m0 });
  await shot(dp, "01_desktop_inicial.png");
  await shot(mp, "01_mobile_inicial.png");

  // 3. Desktop → Command Center + Elite Gold
  const putsBefore = evidence.authCalls.desktop.filter((c) => c.m === "PUT").length;
  await choose(dp, "Sports Command Center", "Elite Gold");
  const syncText = await waitSync(dp);
  const d1 = await current(dp);
  const putsAfter = evidence.authCalls.desktop.filter((c) => c.m === "PUT").length;
  check("3", "Escritorio aplica Command Center + Elite Gold al instante", d1.design === "command" && d1.palette === "gold", { d1, syncText });
  check("3b", "Dos clics seguidos generan una sola escritura (debounce)", putsAfter - putsBefore === 1, { puts: putsAfter - putsBefore });
  await dp.locator("button:visible").filter({ hasText: /^Partidos$/ }).first().click();
  await dp.waitForTimeout(400);
  await shot(dp, "03_desktop_command_gold.png");

  // 4. Verify in Supabase Auth (admin read)
  const m1 = await metaOf(A);
  check("4", "Auth de staging guarda f5_appearance = command/gold", m1.f5_appearance?.design === "command" && m1.f5_appearance?.palette === "gold" && m1.f5_appearance?.updatedAt > 0, { f5_appearance: m1.f5_appearance });
  check("4b", "Los demás campos de user_metadata se conservan", m1.full_name === baseA.full_name && m1.phone === baseA.phone && m1.qa_marker === "keep-me-A" && JSON.stringify(m1.qa_nested) === JSON.stringify(baseA.qa_nested) && m1.preferred_position === baseA.preferred_position, { before: baseA, after: m1 });
  check("4c", "No se guardan campos locales del dispositivo (userId) en Auth", !("userId" in (m1.f5_appearance || {})), m1.f5_appearance);

  // 5. Mobile refresh → gets command/gold
  await mp.reload();
  await mp.waitForSelector("[data-design]");
  await mp.waitForTimeout(1500);
  const m2 = await current(mp);
  check("5", "Móvil al actualizar carga Command Center + Elite Gold", m2.design === "command" && m2.palette === "gold" && m2.view === "command", m2);
  await shot(mp, "05_mobile_command_gold.png");

  // 6. Mobile → Editorial + Club Light
  await choose(mp, "Matchday Editorial", "Club Light");
  await waitSync(mp);
  const m3 = await current(mp);
  const meta3 = await metaOf(A);
  check("6", "Móvil cambia a Editorial + Club Light y se guarda en Auth", m3.design === "editorial" && m3.palette === "light" && meta3.f5_appearance?.design === "editorial" && meta3.f5_appearance?.palette === "light", { local: m3, remote: meta3.f5_appearance });
  await mp.locator("button:visible").filter({ hasText: /^Partidos$/ }).first().click();
  await mp.waitForTimeout(400);
  await shot(mp, "06_mobile_editorial_light.png");

  // Desktop has NOT refreshed: it still shows its older value (no realtime promise).
  const dStale = await current(dp);
  check("6b", "Sin refrescar, escritorio mantiene su valor (no hay sincronización en tiempo real)", dStale.design === "command", dStale);

  // 7. Desktop refresh → recovers newer prefs; its older local copy must NOT overwrite remote
  const putsD = evidence.authCalls.desktop.filter((c) => c.m === "PUT").length;
  await dp.reload();
  await dp.waitForSelector("[data-design]");
  await dp.waitForTimeout(2000);
  const d2 = await current(dp);
  const meta4 = await metaOf(A);
  check("7", "Escritorio al actualizar recupera Editorial + Club Light", d2.design === "editorial" && d2.palette === "light" && d2.view === "editorial", d2);
  check("7b", "El valor antiguo del escritorio no sobrescribió el más reciente (sin escrituras al cargar)", meta4.f5_appearance?.palette === "light" && evidence.authCalls.desktop.filter((c) => c.m === "PUT").length === putsD, { remote: meta4.f5_appearance });
  await shot(dp, "07_desktop_editorial_light.png");

  // 10 (part 1). Idle: no session refresh loops
  const t0 = Date.now();
  await dp.waitForTimeout(8000);
  const idleCalls = evidence.authCalls.desktop.filter((c) => c.t >= t0);
  check("integ-loop", "Sin bucles: 0 llamadas a Auth en 8 s de inactividad", idleCalls.length === 0, idleCalls);
  const loadCalls = evidence.authCalls.desktop.length;

  // 10. Network error on save
  await dp.route("**/auth/v1/user", (route) => (route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.continue()));
  await choose(dp, null, "Midnight Blue");
  await dp.locator(".md-sync").filter({ hasText: /No se pudo sincronizar/ }).waitFor({ timeout: 10000 });
  const dErr = await current(dp);
  const errText = await dp.locator(".md-sync").innerText();
  await shot(dp, "10_error_red_estado.png");
  await dp.locator("button:visible").filter({ hasText: /^Partidos$/ }).first().click();
  await dp.waitForSelector("[data-design]");
  await dp.locator("button:visible").filter({ hasText: /^Reservas$/ }).first().click();
  await dp.waitForURL(/\/reservas/);
  const metaErr = await metaOf(A);
  check("10", "Con error de red: la paleta se aplica localmente, se informa el fallo y la app sigue navegable", dErr.palette === "midnight" && /No se pudo sincronizar/.test(errText) && metaErr.f5_appearance?.palette === "light", { local: dErr.palette, remote: metaErr.f5_appearance?.palette, errText });
  await dp.unroute("**/auth/v1/user");
  await choose(dp, null, "Club Light");
  await waitSync(dp);
  const metaRec = await metaOf(A);
  check("10b", "Al recuperar la red, el siguiente cambio sincroniza", metaRec.f5_appearance?.palette === "light" && metaRec.f5_appearance.updatedAt > meta4.f5_appearance.updatedAt, metaRec.f5_appearance);

  // 8. Sign out and back in
  await dp.locator("button:visible[aria-label='Cerrar sesión']").first().click();
  await dp.waitForTimeout(1500);
  const afterOut = await dp.evaluate((k) => ({ token: localStorage.getItem(k), url: location.pathname, palAttr: document.documentElement.getAttribute("data-f5-palette") }), `sb-${REF}-auth-token`);
  await shot(dp, "08_tras_cerrar_sesion.png");
  const relog = await device(browser, "desktop-relogin", false);
  await signInContext(relog, "A");
  const rp = await open(relog);
  const r1 = await current(rp);
  check("8", "Cerrar sesión e iniciar de nuevo conserva Editorial + Club Light (dispositivo nuevo, sin caché local)", !afterOut.token && r1.design === "editorial" && r1.palette === "light", { afterOut, relogin: r1 });

  // 9. Another user on the same (shared) desktop context keeps their own prefs
  const sessB = await login(U.B.email, U.B.password);
  await dp.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: `sb-${REF}-auth-token`, value: JSON.stringify(sessB) });
  await dp.goto(`${BASE}/partidos`);
  await dp.waitForSelector("[data-design]");
  await dp.waitForTimeout(2000);
  const b1 = await current(dp);
  const metaB = await metaOf(B);
  const metaA9 = await metaOf(A);
  check("9", "Usuario B en el mismo navegador ve SUS preferencias (command/midnight), no las de A", b1.design === "command" && b1.palette === "midnight" && b1.local?.userId === B, b1);
  check("9b", "Ni A ni B fueron sobrescritos al cambiar de cuenta", metaB.f5_appearance?.palette === "midnight" && metaB.f5_appearance?.updatedAt === 1000 && metaA9.f5_appearance?.palette === "light" && metaB.qa_marker === "keep-me-B", { A: metaA9.f5_appearance, B: metaB.f5_appearance });
  await shot(dp, "09_usuario_B_propias_preferencias.png");

  // Roles never depend on editable metadata: B (player) self-writes admin-looking metadata
  const bClient = createClient(env.STG_URL, env.STG_ANON, { auth: { persistSession: false } });
  await bClient.auth.signInWithPassword({ email: U.B.email, password: U.B.password });
  await bClient.auth.updateUser({ data: { role: "super_admin", is_admin: true, is_super_admin: true } });
  await dp.reload();
  await dp.waitForSelector("[data-design]");
  await dp.waitForTimeout(1500);
  const adminButtons = await dp.locator("button:visible").filter({ hasText: /Nuevo partido|Pizarra táctica|^Torneos$/ }).count();
  const { data: memberRow } = await admin.from("group_members").select("role").eq("group_id", U.groupId).eq("profile_id", B).single();
  check("roles", "Metadata editable con 'role/is_admin' no otorga permisos (B sigue como jugador)", adminButtons === 0 && memberRow.role === "player", { adminButtons, dbRole: memberRow.role });
  await shot(dp, "roles_b_sigue_jugador.png");
  await bClient.auth.updateUser({ data: { role: null, is_admin: null, is_super_admin: null } });

  evidence.authCallsSummary = Object.fromEntries(Object.entries(evidence.authCalls).map(([k, v]) => [k, v.reduce((acc, c) => { const key = `${c.m} ${c.p}`; acc[key] = (acc[key] || 0) + 1; return acc; }, {})]));
  evidence.loadCallsDesktopBeforeIdle = loadCalls;
  check("prod", "Ninguna petición hacia producción", evidence.prodRequests.length === 0, evidence.prodRequests);
  await browser.close();
  fs.writeFileSync(path.join(OUT, "staging-results.json"), JSON.stringify({ results, evidence, finalMeta: { A: await metaOf(A), B: await metaOf(B) } }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
