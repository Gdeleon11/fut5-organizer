/* F5 Radar MVP — real React screenshots: Radar list, request sheet, my requests, admin panel + inbox,
 * publish form, bell and group switch, in both experiences, four palettes and three viewports.
 * Local demo data only. Usage: node scripts/radar-shots.cjs <outDir> [quick]
 * (dev server on 127.0.0.1:5173 with empty Supabase env) */
const { chromium } = require("@playwright/test");
const fs = require("fs"); const path = require("path");
const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(process.argv[2] || "radar-shots"); const QUICK = process.argv[3] === "quick";
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = QUICK ? { desktop: [1440, 900], mobile: [375, 812] } : { desktop: [1440, 900], tablet: [768, 1024], mobile: [375, 812] };
const PALETTES = QUICK ? ["neon"] : ["neon", "midnight", "gold", "light"];
const ADMIN_MATCH = "e62c1146-24be-47a3-83f1-778848d7d102";
const report = [];
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
    const shot = async (name, fullPage = full) => {
      await p.waitForTimeout(350);
      report.push({ tag: `${name}_${tag}`, overflow: await overflow(p) });
      await p.screenshot({ path: path.join(OUT, `${name}_${tag}.png`), fullPage });
    };
    const go = async (url, sel) => { await p.evaluate((u) => { history.pushState({}, "", u); dispatchEvent(new PopStateEvent("popstate")); }, url); await p.waitForSelector(sel); };

    await go("/radar", "[data-view=radar] .rd-item"); await shot("radar-list");
    await p.locator(".rd-item", { hasText: "Complejo Mixco" }).click(); await p.waitForSelector(".rd-sheet .rd-form"); await shot("radar-sheet", false);
    await p.keyboard.press("Escape");
    await tab(p, "Mis partidos"); await p.waitForSelector(".rd-req"); await shot("radar-mine");
    await go(`/partidos/${ADMIN_MATCH}`, "[data-radar-panel] .rd-inbox-item");
    await p.locator("[data-radar-panel]").scrollIntoViewIfNeeded(); await shot("radar-admin");
    if (palette === "neon" || palette === "light") {
      await p.locator("[data-radar-panel]").getByRole("button", { name: "Editar" }).click(); await p.waitForSelector(".rd-publish");
      await p.locator(".rd-publish").scrollIntoViewIfNeeded(); await shot("radar-publish", false);
      await go("/grupos", "[data-view=groups]"); await tab(p, "Configuración"); await p.waitForSelector(".rd-settings-form"); await shot("radar-settings");
      await p.locator(".rd-bell button:visible").first().click(); await p.waitForSelector(".rd-bell-pop"); await shot("radar-bell", false);
    }
    await ctx.close();
  }
  await b.close();
  const issues = report.filter((r) => r.overflow || r.error || r.console);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ shots: report.filter((r) => r.tag).length, issues }, null, 2));
  console.log(`shots: ${report.filter((r) => r.tag).length} · issues: ${issues.length}`);
  if (issues.length) console.log(JSON.stringify(issues.slice(0, 12), null, 1));
})();
