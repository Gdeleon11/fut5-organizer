/* Production-build checks: no demo banner / DEV gallery in real sessions; Editorial default; saved prefs kept. */
const { chromium } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@playwright/test");
const { createClient } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@supabase/supabase-js");
const fs = require("fs"); const path = require("path");
const env = Object.fromEntries(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const U = JSON.parse(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg_users.json", "utf8"));
const BASE = "http://127.0.0.1:4173"; const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const admin = createClient(env.STG_URL, env.STG_SERVICE, { auth: { persistSession: false } });
const res = []; const check = (id, ok, d) => { res.push({ id, ok: !!ok, d }); console.log(ok ? "PASS" : "FAIL", id, JSON.stringify(d).slice(0, 300)); };
async function session(who) {
  const c = createClient(env.STG_URL, env.STG_ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: U[who].email, password: U[who].password }); if (error) throw error; return data.session;
}
async function open(browser, who, url = "/partidos") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("**/*iijrkeshjpjmxdsclnmo*/**", (r) => { res.push({ id: "PROD-REQUEST", ok: false, d: r.request().url() }); return r.abort(); });
  const s = await session(who);
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem("__i")) { localStorage.setItem("sb-ylynjvssjlmhzgmhkrsd-auth-token", v); sessionStorage.setItem("__i", "1"); } }, JSON.stringify(s));
  const page = await ctx.newPage(); await page.goto(BASE + url); await page.waitForSelector("[data-design]", { timeout: 30000 }); await page.waitForTimeout(2000);
  return { ctx, page };
}
const state = (page) => page.evaluate(() => ({ design: document.documentElement.getAttribute("data-f5-design"), palette: document.documentElement.getAttribute("data-f5-palette"), banner: /MODO DESARROLLO/i.test(document.body.innerText), gallery: /Galería DEV|datos de prueba/i.test(document.body.innerText) }));

(async () => {
  const browser = await chromium.launch();
  const savedA = (await admin.auth.admin.getUserById(U.A.id)).data.user.user_metadata.f5_appearance;
  // 4) real session on production build: no demo banner; ?f5-gallery=1 is ignored
  let { ctx, page } = await open(browser, "A");
  let s = await state(page);
  check("prod-build-real-session-no-demo-banner", !s.banner, s);
  await page.screenshot({ path: path.join(OUT, "prodbuild_real_session.png") });
  await ctx.close();
  ({ ctx, page } = await open(browser, "A", "/partidos?f5-gallery=1&design=command"));
  s = await state(page);
  check("prod-build-dev-gallery-not-reachable", !s.gallery && !s.banner, s);
  await ctx.close();
  // 5a) account without preferences → Matchday Editorial (+ F5 Neon)
  await admin.auth.admin.updateUserById(U.A.id, { user_metadata: { f5_appearance: null } });
  ({ ctx, page } = await open(browser, "A"));
  s = await state(page);
  const after = (await admin.auth.admin.getUserById(U.A.id)).data.user.user_metadata.f5_appearance;
  check("default-editorial-for-account-without-prefs", s.design === "editorial" && s.palette === "neon" && !after, { s, remoteAfterLoad: after });
  await page.screenshot({ path: path.join(OUT, "prodbuild_default_editorial.png") });
  await ctx.close();
  await admin.auth.admin.updateUserById(U.A.id, { user_metadata: { f5_appearance: savedA } }); // restore A's saved choice
  // 5b) saved choices preserved (B = command/midnight saved earlier; A restored)
  ({ ctx, page } = await open(browser, "B"));
  s = await state(page);
  check("saved-choice-preserved-B", s.design === "command" && s.palette === "midnight", s);
  await ctx.close();
  ({ ctx, page } = await open(browser, "A"));
  s = await state(page);
  check("saved-choice-preserved-A", s.design === savedA.design && s.palette === savedA.palette, { s, savedA });
  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, "rc-prod-checks.json"), JSON.stringify(res, null, 2));
  const f = res.filter((r) => !r.ok); console.log(`\n${res.length - f.length}/${res.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
