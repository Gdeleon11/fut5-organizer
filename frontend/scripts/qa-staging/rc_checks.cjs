/* RC checks: staging REST errors, bottom nav 768/820, Command dock 375/412. */
const { chromium, devices } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@playwright/test");
const { createClient } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@supabase/supabase-js");
const fs = require("fs"); const path = require("path");
const env = Object.fromEntries(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const U = JSON.parse(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg_users.json", "utf8"));
const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const res = []; const check = (id, ok, d) => { res.push({ id, ok: !!ok, d }); console.log(ok ? "PASS" : "FAIL", id, JSON.stringify(d).slice(0, 400)); };

async function session(who) {
  const c = createClient(env.STG_URL, env.STG_ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: U[who].email, password: U[who].password });
  if (error) throw error; return data.session;
}
async function ctxFor(browser, opts, appearance, sess) {
  const ctx = await browser.newContext(opts);
  await ctx.route("**/*iijrkeshjpjmxdsclnmo*/**", (r) => { res.push({ id: "PROD-REQUEST", ok: false, d: r.request().url() }); return r.abort(); });
  await ctx.addInitScript(({ a, s }) => {
    if (a) localStorage.setItem("f5_appearance_v1", JSON.stringify(a));
    if (s && !sessionStorage.getItem("__inj")) { localStorage.setItem("sb-ylynjvssjlmhzgmhkrsd-auth-token", s); sessionStorage.setItem("__inj", "1"); }
  }, { a: appearance, s: sess ? JSON.stringify(sess) : null });
  return ctx;
}
async function demo(page) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /demo|demostración/i }).click();
  await page.waitForSelector("[data-design]");
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();

  // 1) Real staging session: no 4xx from REST, appearance default for an account without prefs.
  {
    const sA = await session("A");
    const ctx = await ctxFor(browser, { viewport: { width: 1440, height: 900 } }, null, sA);
    const page = await ctx.newPage();
    const bad = [];
    page.on("response", async (r) => { if (/supabase\.co\/rest\//.test(r.url()) && r.status() >= 400) bad.push(`${r.status()} ${new URL(r.url()).pathname} ${(await r.text().catch(() => "")).slice(0, 120)}`); });
    await page.goto(`${BASE}/partidos`); await page.waitForSelector("[data-design]"); await page.waitForTimeout(2500);
    for (const l of ["Cobros", "Jugadores", "Reservas"]) { await page.locator("button:visible").filter({ hasText: new RegExp(`^${l}$`) }).first().click(); await page.waitForTimeout(1200); }
    check("staging-rest-no-4xx", bad.length === 0, bad);
    const banner = await page.locator("text=/MODO DESARROLLO/i").count();
    check("real-session-no-demo-banner(dev build)", banner === 0, { banner });
    await page.screenshot({ path: path.join(OUT, "staging_session_cobros.png") });
    await ctx.close();
  }

  // 2) Bottom nav 768 / 820 — both designs
  for (const design of ["editorial", "command"]) for (const w of [768, 820]) {
    const ctx = await ctxFor(browser, { viewport: { width: w, height: 1024 }, isMobile: true, hasTouch: true }, { design, palette: "neon", updatedAt: 1 });
    const page = await ctx.newPage(); await demo(page);
    const items = await page.$$eval(".bottom-nav .bottom-nav-item", (els) => els.map((e) => ({ bg: getComputedStyle(e).backgroundColor, h: Math.round(e.getBoundingClientRect().height), dir: getComputedStyle(e).flexDirection })));
    const nav = await page.$eval(".bottom-nav", (n) => ({ display: getComputedStyle(n).display, top: Math.round(n.getBoundingClientRect().top) }));
    const transparent = items.every((i) => /rgba\(0, 0, 0, 0\)|transparent/.test(i.bg) && i.dir === "column");
    check(`bottomnav-${design}-${w}`, nav.display === "flex" && items.length >= 4 && transparent, { nav, items: items.slice(0, 2) });
    await page.screenshot({ path: path.join(OUT, `bottomnav_${design}_${w}.png`), clip: { x: 0, y: 1024 - 160, width: w, height: 160 } });
    await page.screenshot({ path: path.join(OUT, `tablet_${design}_${w}.png`) });
    await ctx.close();
  }

  // 3) Command dock 375 / 412 — top, bottom of scroll, and with "Nuevo partido" form open
  for (const [w, h] of [[375, 812], [412, 915]]) {
    const ctx = await ctxFor(browser, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { design: "command", palette: "neon", updatedAt: 1 });
    const page = await ctx.newPage(); await demo(page);
    const geo = () => page.evaluate(() => {
      const dock = document.querySelector(".mdc-dock").getBoundingClientRect();
      const nav = document.querySelector(".bottom-nav").getBoundingClientRect();
      const cta = document.querySelector(".mdc-dock .mdc-cta")?.getBoundingClientRect();
      const content = [...document.querySelectorAll(".mdc button, .mdc a, .mdc .mdc-mcard, .mdc .mdc-ledger li, .md-workspace footer")]
        .filter((e) => !e.closest(".mdc-dock") && e.offsetParent !== null);
      const lastBottom = Math.max(...content.map((e) => e.getBoundingClientRect().bottom));
      return { dockTop: Math.round(dock.top), dockBottom: Math.round(dock.bottom), navTop: Math.round(nav.top), ctaBottom: Math.round(cta?.bottom || 0), lastContentBottom: Math.round(lastBottom), vh: innerHeight, scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - innerHeight };
    });
    const g0 = await geo();
    check(`dock-${w}-above-nav`, g0.ctaBottom <= g0.navTop, g0);
    await page.screenshot({ path: path.join(OUT, `dock_${w}_top.png`) });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const g1 = await geo();
    // Every card/button of the page must be able to scroll above the dock (footer may sit behind it).
    const lastInteractive = await page.evaluate(() => {
      const els = [...document.querySelectorAll(".mdc button, .mdc .mdc-mcard, .mdc .mdc-ledger li")].filter((e) => !e.closest(".mdc-dock") && e.offsetParent !== null);
      return Math.round(Math.max(...els.map((e) => e.getBoundingClientRect().bottom)));
    });
    check(`dock-${w}-content-reachable`, lastInteractive <= g1.dockTop, { lastInteractive, dockTop: g1.dockTop });
    await page.screenshot({ path: path.join(OUT, `dock_${w}_scrolled_bottom.png`) });
    // History "Ver resumen"/ledger tap target is clickable (not intercepted by the dock)
    const ledger = page.locator(".mdc-ledger-row").last();
    let clickable = true; try { await ledger.click({ trial: true, timeout: 2000 }); } catch { clickable = false; }
    check(`dock-${w}-ledger-clickable`, clickable, {});
    // Create form open: its submit button must be reachable
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".mdc-bar button", { hasText: "Nuevo partido" }).click();
    await page.waitForTimeout(300);
    const submit = page.locator(".md-create button[type=submit], .md-create button").filter({ hasText: /Crear|Guardar/i }).last();
    await submit.scrollIntoViewIfNeeded();
    let subOk = true; try { await submit.click({ trial: true, timeout: 2000 }); } catch { subOk = false; }
    check(`dock-${w}-form-submit-clickable`, subOk, {});
    await ctx.close();
  }
  // Safe-area math (CSS): dock offset and nav padding both add env(safe-area-inset-bottom)
  const css = fs.readFileSync("/Users/Macbook/Projects/fut5-organizer/frontend/src/matchday.css", "utf8");
  check("dock-safe-area-css", /\.mdc-dock[\s\S]*inset-block-end: calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)/.test(css), {});

  await browser.close();
  fs.writeFileSync(path.join(OUT, "rc-checks.json"), JSON.stringify(res, null, 2));
  const f = res.filter((r) => !r.ok); console.log(`\n${res.length - f.length}/${res.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
