/* Entrega 1 — real React screenshots (demo mode, local data only).
 * Usage: node scripts/e1-shots.cjs <outDir> [quick]   (dev server on 127.0.0.1:5173) */
const { chromium } = require("@playwright/test");
const fs = require("fs"); const path = require("path");
const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(process.argv[2] || "e1-shots"); const QUICK = process.argv[3] === "quick";
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = QUICK ? { desktop: [1440, 900], mobile: [375, 812] } : { desktop: [1440, 900], tablet: [768, 1024], mobile: [375, 812] };
const PALETTES = QUICK ? ["neon"] : ["neon", "midnight", "gold", "light"];
const report = [];

async function ctxFor(b, view, design, palette) {
  const [w, h] = VIEWS[view];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 900 ? { isMobile: true, hasTouch: true } : {}), deviceScaleFactor: 1 });
  await ctx.addInitScript((a) => localStorage.setItem("f5_appearance_v1", JSON.stringify(a)), { design, palette, updatedAt: 1 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => report.push({ view, design, palette, error: String(e).slice(0, 200) }));
  return { ctx, p };
}
async function demo(p) {
  await p.goto(BASE + "/login"); await p.getByRole("button", { name: /demo|demostración/i }).click();
  await p.waitForSelector("[data-design]"); await p.waitForTimeout(300);
}
async function openDetail(p, which = "first") {
  if (which === "past") {
    await p.locator(".mde-hist button.mde-row, .mdc-ledger-row").first().click();
  } else {
    await p.locator(".mde-actions .md-btn-primary:visible, .mdc-acts .mdc-cta:visible, .mdc-dock .mdc-cta:visible, .mde-actions .md-linkbtn:visible").first().click();
  }
  await p.waitForSelector("[data-view=match-detail]"); await p.waitForTimeout(500);
}
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

(async () => {
  const b = await chromium.launch();
  for (const design of ["editorial", "command"]) for (const view of Object.keys(VIEWS)) for (const palette of PALETTES) {
    const { ctx, p } = await ctxFor(b, view, design, palette);
    await demo(p);
    await openDetail(p);
    const tag = `${design}_${view}_${palette}`;
    report.push({ tag, overflow: await overflow(p) });
    await p.screenshot({ path: path.join(OUT, `detail_${tag}.png`) });
    if (palette === "neon" || palette === "light") await p.screenshot({ path: path.join(OUT, `detail_${tag}_full.png`), fullPage: true });
    if (palette === "neon") {
      // admin tools expanded + stats modal
      for (const g of await p.locator("details.mdd-admin-group").all()) await g.evaluate((el) => (el.open = true));
      await p.locator("#admin").scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(OUT, `admin_${design}_${view}.png`) });
      await p.locator("button", { hasText: "Cargar estadísticas" }).first().click();
      await p.waitForSelector(".mdd-stats-modal");
      await p.screenshot({ path: path.join(OUT, `statsmodal_${design}_${view}.png`) });
      await p.keyboard.press("Escape");
      // teams + FIFA card
      await p.locator("#equipos").scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
      await p.screenshot({ path: path.join(OUT, `teams_${design}_${view}.png`) });
      // past match → result section
      await p.locator(".mdd-back").first().click(); await p.waitForSelector("[data-design]");
      await openDetail(p, "past");
      await p.locator("#resumen").scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: path.join(OUT, `result_${design}_${view}.png`) });
      // pizarra + create form
      await p.locator(".mdd-back").first().click(); await p.waitForSelector("[data-design]");
      await p.locator("button:visible", { hasText: /^Nuevo partido$/ }).first().click(); await p.waitForTimeout(300);
      await p.locator(".md-create").scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(OUT, `form_${design}_${view}.png`) });
      await p.locator(".md-create").screenshot({ path: path.join(OUT, `form_${design}_${view}_panel.png`) }).catch(() => {});
      await p.locator(".md-form-actions button", { hasText: "Cancelar" }).click();
      await p.locator("button:visible", { hasText: /Pizarra táctica/ }).first().click(); await p.waitForTimeout(400);
      const all = p.locator("button:visible", { hasText: /^Todos$/ }).first();
      if (await all.count()) {
        await all.click();
        const sim = p.getByRole("button", { name: "Simular", exact: true });
        if ((await sim.count()) && (await sim.isEnabled())) { await sim.click(); await p.waitForTimeout(400); }
      }
      await p.screenshot({ path: path.join(OUT, `pizarra_${design}_${view}.png`), fullPage: view !== "mobile" });
      report.push({ tag: `pizarra_${design}_${view}`, overflow: await overflow(p) });
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.error || r.overflow);
  console.log(`shots ${fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length}, issues ${bad.length}`);
  bad.forEach((x) => console.log(JSON.stringify(x)));
})().catch((e) => { console.error(e); process.exit(1); });
