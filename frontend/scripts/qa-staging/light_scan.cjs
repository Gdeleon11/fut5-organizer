/* Club Light audit of inner screens (demo mode: local fixtures, no backend writes). */
const { chromium, devices } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = process.argv[2];
const DESIGN = process.argv[3] || "editorial";
fs.mkdirSync(OUT, { recursive: true });

const SCAN = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  function bgOf(el) {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const img = cs.backgroundImage || "none";
      if (img !== "none" && !/gradient/.test(img)) return null; // photo: skip
      let c = parse(cs.backgroundColor);
      if (/^linear-gradient/.test(img)) { const g = parse(img.slice(img.indexOf("rgb"))); if (g && g.a > 0.5) c = g; }
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const body = parse(getComputedStyle(document.body).backgroundColor);
    if (body && body.a) bg = body;
    for (let i = stack.length - 1; i >= 0; i--) bg = blend(stack[i], bg);
    return bg;
  }
  const out = [];
  const walker = document.createTreeWalker(document.querySelector(".md-workspace main") || document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode; const el = t.parentElement;
    if (!el || seen.has(el) || !t.textContent.trim()) continue;
    seen.add(el);
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || Number(cs.opacity) < 0.2) continue;
    if (el.closest("input,select,textarea,[aria-hidden=true],.fifa-card,.md-thumb,.mdc-pitchwrap,.section-hero,svg")) continue;
    if (el.closest("button:disabled")) continue;
    const fg = parse(cs.color); const bg = bgOf(el);
    if (!fg || !bg) continue;
    const f = blend(fg, bg);
    const L1 = lum(f), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    if (ratio < need) out.push({ text: t.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, need, color: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, cls: (el.className || "").toString().slice(0, 50), tag: el.tagName });
  }
  // invisible controls: buttons/inputs whose own bg ≈ page bg and no border
  return out;
};

async function nav(page, label) {
  const d = page.locator("button:visible").filter({ hasText: new RegExp(`^${label}$`) }).first();
  if (await d.count()) return d.click();
  await page.locator('button[title="Más opciones"]:visible').first().click();
  await page.locator("button:visible").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
}
async function clickText(page, re) {
  const b = page.locator("button:visible, [role=tab]:visible").filter({ hasText: re }).first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(350); return true; }
  return false;
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const [vw, mobile] of [["1280", false], ["375", true]]) {
    const ctx = await browser.newContext(mobile ? { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } } : { viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((d) => localStorage.setItem("f5_appearance_v1", JSON.stringify({ design: d, palette: "light", updatedAt: 1 })), DESIGN);
    await ctx.route("**/*.supabase.co/**", (r) => r.abort()); // demo is local; nothing must leave
    const page = await ctx.newPage();
    await page.goto("http://127.0.0.1:5173/login");
    await page.getByRole("button", { name: /demo|demostración/i }).click();
    await page.waitForSelector("[data-design]");
    const screens = [
      ["partidos", async () => {}],
      ["partidos_crear", async () => { await clickText(page, /^Nuevo partido$/); }],
      ["detalle_partido", async () => { await nav(page, "Partidos"); await clickText(page, /^Ver partido$/); }],
      ["detalle_equipos", async () => { await clickText(page, /Equipos/); }],
      ["detalle_partido_tab", async () => { await clickText(page, /^Partido$|Resultado|Stats/); }],
      ["detalle_admin", async () => { await clickText(page, /Admin|Gestión|Gestionar/); }],
      ["pizarra", async () => { await nav(page, "Partidos"); await clickText(page, /Pizarra táctica/); }],
      ["reservas", async () => { await nav(page, "Partidos"); await nav(page, "Reservas"); }],
      ["cobros_caja", async () => { await nav(page, "Cobros"); }],
      ["cobros_cuotas", async () => { await clickText(page, /Cobros y Cuotas/i); }],
      ["cobros_multas", async () => { await clickText(page, /Multas/); }],
      ["jugadores", async () => { await nav(page, "Jugadores"); }],
      ["jugadores_tags", async () => { await clickText(page, /Subgrupos y tags/i); }],
      ["jugadores_stats", async () => { await clickText(page, /Subir estadísticas/i); }],
      ["jugadores_ranking", async () => { await clickText(page, /Ranking/i); }],
      ["mi_fifa", async () => { await nav(page, "Mi FIFA"); }],
      ["torneos", async () => { await nav(page, "Torneos"); }],
      ["grupos", async () => { await page.evaluate(() => {}); const g = page.locator("button:visible[aria-label='Mis grupos']"); if (await g.count()) await g.first().click(); }],
    ];
    for (const [name, go] of screens) {
      try { await go(); } catch (e) { report[`${vw}_${name}`] = { error: String(e).slice(0, 120) }; continue; }
      await page.waitForTimeout(450);
      // close any modal that might be open (post-match survey) after capture
      const issues = await page.evaluate(SCAN);
      report[`${vw}_${name}`] = { url: new URL(page.url()).pathname, issues };
      await page.screenshot({ path: path.join(OUT, `${DESIGN}_${vw}_${name}.png`), fullPage: !mobile });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `light-scan-${DESIGN}.json`), JSON.stringify(report, null, 2));
  for (const [k, v] of Object.entries(report)) console.log(k, v.error ? "ERROR " + v.error : `${v.url} issues=${v.issues.length}`, v.issues ? JSON.stringify(v.issues.slice(0, 4)) : "");
})().catch((e) => { console.error(e); process.exit(1); });
