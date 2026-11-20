/* Entrega 4 — real React screenshots of Torneos (lista, calendario, tabla, llaves, equipos, alta), Grupos/Roles
 * and the public token pages. Local demo data only. Usage: node scripts/e4-shots.cjs <outDir> [quick]
 * (dev server on 127.0.0.1:5173 with empty Supabase env) */
const { chromium } = require("@playwright/test");
const fs = require("fs"); const path = require("path");
const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(process.argv[2] || "e4-shots"); const QUICK = process.argv[3] === "quick";
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = QUICK ? { desktop: [1440, 900], mobile: [375, 812] } : { desktop: [1440, 900], tablet: [768, 1024], mobile: [375, 812] };
const PALETTES = QUICK ? ["neon"] : ["neon", "midnight", "gold", "light"];
const report = [];
// Compare with the configured viewport width: mobile browsers widen the layout viewport when content overflows.
const overflow = (p) => p.evaluate((w) => document.documentElement.scrollWidth > w + 1 || innerWidth > w + 1, p.viewportSize().width);
const tab = (p, name) => p.locator(".pl-tabs button", { hasText: name }).first().click();
(async () => {
  const b = await chromium.launch();
  for (const design of ["editorial", "command"]) for (const view of Object.keys(VIEWS)) for (const palette of PALETTES) {
    const [w, h] = VIEWS[view];
    const full = palette === "neon";
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 900 ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.addInitScript((a) => localStorage.setItem("f5_appearance_v1", JSON.stringify(a)), { design, palette, updatedAt: 1 });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => report.push({ design, view, palette, error: String(e).slice(0, 200) }));
    p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) report.push({ design, view, palette, console: m.text().slice(0, 200) }); });
    await p.goto(BASE + "/login"); await p.getByRole("button", { name: /demo|demostración/i }).click(); await p.waitForSelector("[data-design]");
    const tag = `${design}_${view}_${palette}`;
    const shot = async (name) => {
      await p.waitForTimeout(350);
      report.push({ tag: `${name}_${tag}`, overflow: await overflow(p) });
      await p.screenshot({ path: path.join(OUT, `${name}_${tag}.png`), fullPage: full });
    };
    const go = async (url, sel) => { await p.evaluate((u) => { history.pushState({}, "", u); dispatchEvent(new PopStateEvent("popstate")); }, url); await p.waitForSelector(sel); };
    await go("/torneos", "[data-view=tournaments] .tn-list-item"); await shot("tournaments");
    await p.locator(".tn-list-item", { hasText: "Liga Apertura" }).click(); await p.waitForSelector(".tn-fixture"); await shot("tn-fixtures");
    await tab(p, "Tabla"); await p.waitForSelector(".tn-table"); await shot("tn-standings");
    await tab(p, "Llaves"); await p.waitForSelector(".tn-bracket"); await shot("tn-bracket");
    if (palette === "neon" || palette === "light") {
      await tab(p, "Equipos"); await shot("tn-teams");
      await p.locator(".tn-back").click();
      await p.locator(".tn-list-item", { hasText: "Copa Relámpago" }).click(); await p.waitForSelector(".tn-fixture"); await tab(p, "Llaves"); await shot("tn-cup-bracket");
      await p.locator(".tn-back").click();
      await p.locator(".tn-list-item", { hasText: "Torneo de Verano" }).click(); await p.waitForSelector(".tn-setup"); await shot("tn-setup-names");
      await p.getByRole("button", { name: /Siguiente/ }).click(); await p.getByRole("button", { name: /Auto-balancear/ }).click(); await shot("tn-setup-assign");
      await p.locator(".tn-back").click();
      await p.getByRole("button", { name: /Nuevo torneo/ }).click(); await p.waitForSelector(".tn-formats"); await shot("tn-form");
    }
    await go("/grupos", "[data-view=groups]"); await shot("groups");
    await tab(p, "Roles y permisos"); await p.waitForSelector(".gr-matrix"); await shot("roles");
    await ctx.close();
  }
  // Public pages: identity is independent of design/palette → once per viewport (error states in local demo).
  for (const [view, [w, h]] of Object.entries(VIEWS)) for (const scheme of ["dark", "light"]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => report.push({ view, scheme, error: String(e).slice(0, 200) }));
    // /proof/<token> needs a Supabase session, so it is covered on staging; locally only /reserve renders.
    for (const [name, url] of [["public-reserve", "/reserve/abc123"]]) {
      await p.goto(BASE + url); await p.waitForSelector(".pub-card"); await p.waitForTimeout(500);
      report.push({ tag: `${name}_${view}_${scheme}`, overflow: await overflow(p) });
      await p.screenshot({ path: path.join(OUT, `${name}_${view}_${scheme}.png`) });
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.error || r.overflow || r.console);
  console.log(`shots ${fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length}, issues ${bad.length}`);
  bad.slice(0, 30).forEach((x) => console.log(JSON.stringify(x)));
})().catch((e) => { console.error(e); process.exit(1); });
