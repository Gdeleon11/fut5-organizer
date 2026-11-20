/* Entrega 3 — real React screenshots of Cobros (caja, cuotas, multas), Reservas (agenda, calendario, lista) y Sedes.
 * Local demo data only. Usage: node scripts/e3-shots.cjs <outDir> [quick]
 * (dev server on 127.0.0.1:5173 with empty Supabase env) */
const { chromium } = require("@playwright/test");
const fs = require("fs"); const path = require("path");
const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(process.argv[2] || "e3-shots"); const QUICK = process.argv[3] === "quick";
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
const tab = (p, name) => p.locator(".pl-tabs button", { hasText: name }).first().click();
// Compare with the configured viewport width: mobile browsers widen the layout viewport when content overflows.
const overflow = (p) => p.evaluate((w) => document.documentElement.scrollWidth > w + 1 || innerWidth > w + 1, p.viewportSize().width);
async function setRole(p, label) {
  const sel = p.locator("select").filter({ has: p.locator("option", { hasText: /Jugador/ }) }).first();
  if (!(await sel.count())) return false;
  const opts = await sel.locator("option").allTextContents();
  const o = opts.find((t) => new RegExp(label).test(t));
  if (!o) return false;
  await sel.selectOption({ label: o }); await p.waitForTimeout(300); return true;
}
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
      await p.waitForTimeout(300);
      report.push({ tag: `${name}_${tag}`, overflow: await overflow(p) });
      await p.screenshot({ path: path.join(OUT, `${name}_${tag}.png`), fullPage: full });
    };
    await nav(p, "Cobros"); await p.waitForSelector("[data-view=treasury]"); await shot("treasury");
    await tab(p, "Cobros y cuotas"); await p.waitForSelector("[data-view=fees]"); await shot("fees");
    if (palette === "neon" || palette === "light") {
      const review = p.locator(".fx-act.is-review").first();
      if (await review.count()) { await review.click(); await p.waitForSelector(".fx-proof-modal"); await shot("proofmodal"); await p.keyboard.press("Escape"); }
    }
    await tab(p, "Multas"); await p.waitForSelector("[data-view=fines]"); await shot("fines");
    await nav(p, "Reservas"); await p.waitForSelector("[data-view=reservations]"); await shot("reservations");
    if (palette === "neon" || palette === "light") {
      await p.locator(".fx-seg button", { hasText: /^Tarjetas$/ }).click(); await shot("reservations-cards");
      await p.locator(".fx-seg button", { hasText: /^Lista$/ }).click(); await shot("reservations-list");
      await p.locator(".rv-delegate .md-btn-accent").first().click(); await p.waitForSelector(".rv-form"); await shot("reservation-form");
    }
    await tab(p, "Sedes y canchas"); await shot("venues");
    if (palette === "neon") {
      if (await setRole(p, "Jugador")) {
        await nav(p, "Cobros"); await p.waitForSelector("[data-view=treasury]");
        await tab(p, "Cobros y cuotas"); await p.waitForSelector("[data-view=my-fees]"); await shot("player-fees");
        await tab(p, "Multas"); await shot("player-fines");
      }
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.error || r.overflow || r.console);
  console.log(`shots ${fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length}, issues ${bad.length}`);
  bad.slice(0, 30).forEach((x) => console.log(JSON.stringify(x)));
})().catch((e) => { console.error(e); process.exit(1); });
