/* Real-React screenshots of both Matchday experiences (demo mode + DEV states gallery).
 * Usage: node scripts/matchday-shots.cjs <outDir>   (dev server must be on 127.0.0.1:5173)
 * Demo mode only: no Supabase session, nothing is written to any backend. */
const { chromium, devices } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(process.argv[2] || "matchday-shots");
const WIDTHS = [
  [1440, 900], [1280, 800], [1100, 800], [1024, 768], [768, 1024], [412, 915], [375, 812],
];
const DESIGNS = ["editorial", "command"];
const PALETTES = ["neon", "midnight", "gold", "light"];
const report = [];

async function enterDemo(page) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /demo|demostración/i }).click();
  await page.waitForSelector("[data-design]", { timeout: 15000 });
  await page.waitForTimeout(400);
}

async function newPage(browser, w, h, appearance, mobile) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  await ctx.addInitScript((a) => {
    localStorage.setItem("f5_appearance_v1", JSON.stringify({ ...a, updatedAt: 1 }));
  }, appearance);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => report.push({ kind: "pageerror", msg: String(e) }));
  return { ctx, page };
}

async function layoutChecks(page, label) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const nav = document.querySelector(".bottom-nav");
    const navTop = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : innerHeight;
    const visible = (el) => el && el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden";
    const ctas = [...document.querySelectorAll(".mde-actions .md-btn-primary, .mdc-dock .mdc-cta, .mdc-acts .mdc-cta, .mde-empty .md-btn-primary")].filter(visible);
    const cta = ctas[0];
    const rect = cta ? cta.getBoundingClientRect() : null;
    return {
      hScroll: doc.scrollWidth > innerWidth + 1,
      scrollWidth: doc.scrollWidth,
      innerWidth,
      ctaText: cta ? cta.textContent.trim() : null,
      ctaTop: rect ? Math.round(rect.top) : null,
      ctaBottom: rect ? Math.round(rect.bottom) : null,
      navTop: Math.round(navTop),
      ctaInFirstViewport: rect ? rect.bottom <= Math.min(innerHeight, navTop) + 1 : null,
      design: document.querySelector("[data-design]")?.getAttribute("data-design"),
      palette: doc.getAttribute("data-f5-palette"),
      state: document.querySelector("[data-match-state]")?.getAttribute("data-match-state"),
    };
  });
  report.push({ kind: "layout", label, ...r });
  return r;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // 1) Both designs × all widths (F5 Neon), demo data.
  for (const design of DESIGNS) {
    for (const [w, h] of WIDTHS) {
      const mobile = w < 900;
      const { ctx, page } = await newPage(browser, w, h, { design, palette: "neon" }, mobile);
      await enterDemo(page);
      await layoutChecks(page, `${design}-${w}`);
      await page.screenshot({ path: path.join(OUT, `${design}_neon_${w}.png`) });
      if (w === 1440 || w === 375) await page.screenshot({ path: path.join(OUT, `${design}_neon_${w}_full.png`), fullPage: true });
      await ctx.close();
    }
  }

  // 2) Every palette × design at 1440 and 375.
  for (const design of DESIGNS) {
    for (const palette of PALETTES) {
      for (const [w, h] of [[1440, 900], [375, 812]]) {
        const { ctx, page } = await newPage(browser, w, h, { design, palette }, w < 900);
        await enterDemo(page);
        await layoutChecks(page, `${design}-${palette}-${w}`);
        await page.screenshot({ path: path.join(OUT, `${design}_${palette}_${w}.png`) });
        await ctx.close();
      }
    }
  }

  // 3) All 7 states through the DEV gallery (real MatchesPage, labelled test fixtures).
  for (const design of DESIGNS) {
    const { ctx, page } = await newPage(browser, 1280, 900, { design, palette: "neon" }, false);
    await page.goto(`${BASE}/?f5-gallery=1&design=${design}&palette=neon`);
    await page.waitForSelector("[data-gallery-state]");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `states_${design}_1280_full.png`), fullPage: true });
    for (const s of ["confirmed", "available", "waitlist", "full", "cancelled", "finished", "empty"]) {
      const hero = page.locator(`[data-gallery-state="${s}"]`).locator(".mde-hero, .mde-empty, .mdc-arena").first();
      await hero.screenshot({ path: path.join(OUT, `state_${design}_${s}.png`) });
    }
    await ctx.close();
    // mobile single-state shots (dock visible for command)
    for (const s of ["available", "waitlist", "full"]) {
      const m = await newPage(browser, 375, 812, { design, palette: "neon" }, true);
      await m.page.goto(`${BASE}/?f5-gallery=1&design=${design}&palette=neon&state=${s}`);
      await m.page.waitForSelector("[data-gallery-state]");
      await m.page.waitForTimeout(300);
      await m.page.screenshot({ path: path.join(OUT, `state_${design}_${s}_375.png`) });
      await m.ctx.close();
    }
  }

  // 4) Profile → Apariencia, and Club Light on other pages (legibility).
  for (const [w, h] of [[1280, 900], [375, 812]]) {
    const { ctx, page } = await newPage(browser, w, h, { design: "editorial", palette: "neon" }, w < 900);
    await enterDemo(page);
    const btn = page.locator("button:visible", { hasText: /^Mi FIFA$/ }).first();
    if (await btn.count()) await btn.click();
    else {
      await page.locator('button[title="Más opciones"]:visible').first().click();
      await page.locator("button:visible", { hasText: /^Mi FIFA$/ }).first().click();
    }
    await page.locator("#apariencia").scrollIntoViewIfNeeded();
    await page.locator("#apariencia").screenshot({ path: path.join(OUT, `apariencia_${w}.png`) });
    await ctx.close();
  }

  for (const route of ["Reservas", "Cobros", "Jugadores", "Mi FIFA", "Torneos"]) {
    for (const design of DESIGNS) {
      const { ctx, page } = await newPage(browser, 1280, 900, { design, palette: "light" }, false);
      await enterDemo(page);
      await page.locator("button:visible", { hasText: new RegExp(`^${route}$`) }).first().click();
      await page.waitForTimeout(500);
      await layoutChecks(page, `light-${design}-${route}`);
      await page.screenshot({ path: path.join(OUT, `light_${design}_${route.replace(/\s/g, "")}_1280.png`) });
      await ctx.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.kind === "pageerror" || r.hScroll || r.ctaInFirstViewport === false);
  console.log(`shots: ${fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length}, issues: ${bad.length}`);
  for (const b of bad) console.log(JSON.stringify(b));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
