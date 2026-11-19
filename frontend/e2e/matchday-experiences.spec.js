import { test, expect } from "./local-demo.js";

// Isolated demo mode only: no Supabase session, no backend writes.
async function enterDemo(page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /demo|demostración/i }).click();
  await expect(page.locator("[data-design]")).toBeVisible();
}

async function openProfile(page) {
  const direct = page.locator("button:visible").filter({ hasText: /^Mi FIFA$/ }).first();
  if (await direct.count()) await direct.click();
  else {
    await page.locator('button[title="Más opciones"]:visible').first().click();
    await page.locator("button:visible").filter({ hasText: /^Mi FIFA$/ }).first().click();
  }
  // Profile → "Apariencia · Cambiar diseño" shortcut → dedicated /apariencia screen
  await page.locator("button.md-appearance-shortcut:visible").click();
  await expect(page).toHaveURL(/\/apariencia/);
  await expect(page.locator("#apariencia")).toBeVisible();
}

async function goMatches(page) {
  await page.locator("button:visible").filter({ hasText: /^Partidos$/ }).first().click();
  await expect(page.locator("[data-design]")).toBeVisible();
}

test.describe("F5 Matchday — dos experiencias y paletas", () => {
  test("default is Matchday Editorial with real demo match and no horizontal scroll", async ({ page }) => {
    await enterDemo(page);
    await expect(page.locator("[data-design]")).toHaveAttribute("data-design", "editorial");
    await expect(page.locator("html")).toHaveAttribute("data-f5-palette", "neon");
    await expect(page.locator(".mde-hero")).toContainText("Plaza 1 - Sintética");
    await expect(page.locator("[data-match-state]")).toHaveAttribute("data-match-state", "confirmed");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });

  test("switches design and palette live from Apariencia, without reload or sign-out", async ({ page }) => {
    await enterDemo(page);
    await page.evaluate(() => { window.__noReload = true; });
    await openProfile(page);

    await page.locator("label.md-design-opt", { hasText: "Sports Command Center" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-f5-design", "command");

    for (const [label, id] of [["Midnight Blue", "midnight"], ["Elite Gold", "gold"], ["Club Light", "light"], ["F5 Neon", "neon"]]) {
      await page.locator("label.md-palette-opt", { hasText: label }).click();
      await expect(page.locator("html")).toHaveAttribute("data-f5-palette", id);
    }
    await page.locator("label.md-palette-opt", { hasText: "Club Light" }).click();

    await goMatches(page);
    await expect(page.locator("[data-design]")).toHaveAttribute("data-design", "command");
    await expect(page.locator(".mdc-arena")).toBeVisible();
    await expect(page.locator(".mdc-ring")).toContainText("/15");
    // Same page session: no reload happened, demo session is intact.
    expect(await page.evaluate(() => window.__noReload)).toBe(true);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe("rgb(13, 15, 14)");
  });

  test("preference persists across reloads", async ({ page }) => {
    await enterDemo(page);
    await openProfile(page);
    await page.locator("label.md-design-opt", { hasText: "Sports Command Center" }).click();
    await page.locator("label.md-palette-opt", { hasText: "Elite Gold" }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("f5_appearance_v1")));
    expect(stored).toMatchObject({ design: "command", palette: "gold" });

    await page.reload();
    await enterDemo(page);
    await expect(page.locator("[data-design]")).toHaveAttribute("data-design", "command");
    await expect(page.locator("html")).toHaveAttribute("data-f5-palette", "gold");
  });

  test("public pages are not themed by the in-app palette", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("f5_appearance_v1", JSON.stringify({ design: "command", palette: "light", updatedAt: 1 })));
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-f5-palette", /.+/);
  });

  test("tablet 768 px: bottom navigation items are not painted as green buttons", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await enterDemo(page);
    const items = await page.$$eval(".bottom-nav .bottom-nav-item", (els) =>
      els.map((e) => ({ bg: getComputedStyle(e).backgroundColor, dir: getComputedStyle(e).flexDirection })),
    );
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const i of items) {
      expect(i.bg).toBe("rgba(0, 0, 0, 0)");
      expect(i.dir).toBe("column");
    }
  });

  for (const design of ["editorial", "command"]) {
    test(`${design}: main action is reachable and not covered by the bottom nav`, async ({ page }) => {
      await page.addInitScript((d) => localStorage.setItem("f5_appearance_v1", JSON.stringify({ design: d, palette: "neon", updatedAt: 1 })), design);
      await enterDemo(page);
      const cta = page
        .locator(".mde-actions .md-btn-primary:visible, .mdc-dock .mdc-cta:visible, .mdc-acts .mdc-cta:visible")
        .first();
      await expect(cta).toBeVisible();
      const geo = await cta.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const nav = document.querySelector(".bottom-nav");
        const navTop = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : window.innerHeight;
        return { bottom: r.bottom, navTop, vh: window.innerHeight };
      });
      expect(geo.bottom).toBeLessThanOrEqual(geo.navTop + 1);
      await cta.click();
      await expect(page).toHaveURL(/\/partidos\//);
    });

    test(`${design}: desktop sidebar / mobile nav keep every destination reachable`, async ({ page }) => {
      await page.addInitScript((d) => localStorage.setItem("f5_appearance_v1", JSON.stringify({ design: d, palette: "midnight", updatedAt: 1 })), design);
      await enterDemo(page);
      for (const [label, url] of [["Reservas", /\/reservas/], ["Cobros", /\/cobros-caja/], ["Jugadores", /\/jugadores/]]) {
        await page.locator("button:visible").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
        await expect(page).toHaveURL(url);
      }
      await goMatches(page);
    });
  }
});

test.describe("F5 Matchday — acceso al selector de Apariencia", () => {
  test("desktop sidebar / mobile profile menu show a labelled Apariencia entry that opens /apariencia", async ({ page, isMobile }) => {
    await enterDemo(page);
    if (!isMobile) {
      const entry = page.locator(".md-side button.md-appearance-entry");
      await expect(entry).toBeVisible();
      await expect(entry).toContainText("Apariencia");
      await entry.click();
    } else {
      await page.locator(".f5-app-header button[aria-label='Menú de usuario']").first().click();
      await page.locator("button:visible").filter({ hasText: /^Apariencia$/ }).first().click();
    }
    await expect(page).toHaveURL(/\/apariencia/);
    await expect(page.locator("h1#md-appearance-title")).toHaveText("Apariencia");
    await expect(page.locator("[data-preview=editorial]")).toBeAttached();
    await expect(page.locator("[data-preview=command]")).toBeAttached();
    await expect(page.locator(".md-design-opt.is-selected")).toContainText("Activo");
  });

  test("mobile Más menu lists Apariencia (when the menu exists)", async ({ page, isMobile }) => {
    test.skip(!isMobile, "bottom navigation only on mobile");
    await enterDemo(page); // demo user is Super Admin ⇒ 6 items ⇒ "Más" menu
    await page.locator('button[title="Más opciones"]:visible').first().click();
    await page.locator("button:visible").filter({ hasText: /^Apariencia$/ }).first().click();
    await expect(page).toHaveURL(/\/apariencia/);
  });

  test("Sports Command Center + F5 Neon shows the tactical pitch with confirmed players, and Editorial comes back keeping the palette", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/apariencia").catch(() => {});
    if (!(await page.locator("#apariencia").count())) {
      await enterDemo(page);
      await openProfile(page);
    }
    await page.locator("label.md-design-opt", { hasText: "Sports Command Center" }).click();
    await page.locator("label.md-palette-opt", { hasText: "F5 Neon" }).click();
    await expect(page.locator(".md-appearance-current")).toContainText("Sports Command Center");
    await expect(page.locator(".md-appearance-current")).toContainText("F5 Neon");
    await goMatches(page);
    await expect(page.locator("html")).toHaveAttribute("data-f5-design", "command");
    await expect(page.locator("html")).toHaveAttribute("data-f5-palette", "neon");
    const arena = page.locator(".mdc-arena");
    await expect(arena).toBeVisible();
    const ring = (await page.locator(".mdc-ring b").innerText()).trim(); // e.g. "7/15"
    const confirmed = Number(ring.split("/")[0]);
    expect(confirmed).toBeGreaterThan(0);
    await expect(page.locator(".mdc-lineup .mdc-tok.on")).toHaveCount(confirmed);
    await expect(page.locator(".mdc-lineup .mdc-tok.me")).toHaveCount(1);
    await expect(page.locator(".mdc-lineup")).toContainText("Guille"); // demo player names on the tokens

    await openProfile(page);
    await page.locator("label.md-design-opt", { hasText: "Matchday Editorial" }).click();
    await goMatches(page);
    await expect(page.locator("html")).toHaveAttribute("data-f5-design", "editorial");
    await expect(page.locator("html")).toHaveAttribute("data-f5-palette", "neon");
    await expect(page.locator(".mde-hero")).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("f5_appearance_v1")));
    expect(stored).toMatchObject({ design: "editorial", palette: "neon" });
  });
});
