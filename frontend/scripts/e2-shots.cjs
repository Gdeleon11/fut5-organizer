/* Entrega 2 — real React screenshots of Jugadores, ficha, Ranking and Mi FIFA (local demo data only).
 * Usage: node scripts/e2-shots.cjs <outDir> [quick]   (dev server on 127.0.0.1:5173 with empty Supabase env) */
const { chromium } = require("@playwright/test");
const fs = require("fs"); const path = require("path");
const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(process.argv[2] || "e2-shots"); const QUICK = process.argv[3] === "quick";
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = QUICK ? { desktop: [1440, 900], mobile: [375, 812] } : { desktop: [1440, 900], tablet: [768, 1024], mobile: [375, 812] };
const PALETTES = QUICK ? ["neon"] : ["neon", "midnight", "gold", "light"];
const report = [];
async function nav(p, label) {
  const d = p.locator("button:visible").filter({ hasText: new RegExp(`^${label}$`) }).first();
  if (await d.count()) return d.click();
  await p.locator('button[title="Más opciones"]:visible').first().click();
  await p.locator("button:visible").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
}
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
(async () => {
  const b = await chromium.launch();
  for (const design of ["editorial", "command"]) for (const view of Object.keys(VIEWS)) for (const palette of PALETTES) {
    const [w, h] = VIEWS[view];
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 900 ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.addInitScript((a) => localStorage.setItem("f5_appearance_v1", JSON.stringify(a)), { design, palette, updatedAt: 1 });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => report.push({ design, view, palette, error: String(e).slice(0, 200) }));
    await p.goto(BASE + "/login"); await p.getByRole("button", { name: /demo|demostración/i }).click(); await p.waitForSelector("[data-design]");
    const tag = `${design}_${view}_${palette}`;
    await nav(p, "Jugadores"); await p.waitForSelector("[data-view=players]"); await p.waitForTimeout(300);
    report.push({ tag: `players_${tag}`, overflow: await overflow(p) });
    await p.screenshot({ path: path.join(OUT, `players_${tag}.png`), fullPage: palette === "neon" });
    await p.locator(".pl-ed-row, .pl-cc-card").first().click(); await p.waitForSelector("[data-view=player]"); await p.waitForTimeout(400);
    report.push({ tag: `player_${tag}`, overflow: await overflow(p) });
    await p.screenshot({ path: path.join(OUT, `player_${tag}.png`), fullPage: palette === "neon" });
    if (palette === "neon" || palette === "light") {
      await p.locator(".mdd-back").first().click(); await p.waitForSelector("[data-view=players]");
      await p.locator(".pl-tabs button", { hasText: "Ranking" }).click(); await p.waitForSelector("[data-view=ranking]"); await p.waitForTimeout(300);
      report.push({ tag: `ranking_${tag}`, overflow: await overflow(p) });
      await p.screenshot({ path: path.join(OUT, `ranking_${tag}.png`), fullPage: true });
      await p.locator(".pl-tabs button", { hasText: "Subgrupos" }).click().catch(() => {}); await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(OUT, `subgroups_${tag}.png`), fullPage: view !== "mobile" });
    }
    await nav(p, "Mi FIFA"); await p.waitForSelector("[data-view=mi-fifa]"); await p.waitForTimeout(500);
    report.push({ tag: `mififa_${tag}`, overflow: await overflow(p) });
    await p.screenshot({ path: path.join(OUT, `mififa_${tag}.png`), fullPage: palette === "neon" });
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.error || r.overflow);
  console.log(`shots ${fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length}, issues ${bad.length}`);
  bad.forEach((x) => console.log(JSON.stringify(x)));
})().catch((e) => { console.error(e); process.exit(1); });
