import { test, expect } from "@playwright/test";

// Entrega 2 — Jugadores, ficha, Ranking y Mi FIFA. Isolated local demo only.
async function enterDemo(page, design, palette = "neon") {
  await page.addInitScript(({ d, p }) => localStorage.setItem("f5_appearance_v1", JSON.stringify({ design: d, palette: p, updatedAt: 1 })), { d: design, p: palette });
  await page.goto("/login");
  await page.getByRole("button", { name: /demo|demostración/i }).click();
  await expect(page.locator("[data-design]")).toBeVisible();
}
async function nav(page, label) {
  const d = page.locator("button:visible").filter({ hasText: new RegExp(`^${label}$`) }).first();
  if (await d.count()) return d.click();
  await page.locator('button[title="Más opciones"]:visible').first().click();
  await page.locator("button:visible").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
}
const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

for (const design of ["editorial", "command"]) {
  test.describe(`Jugadores y Mi FIFA — ${design}`, () => {
    test("directory search, player view and back", async ({ page }) => {
      await enterDemo(page, design);
      await nav(page, "Jugadores");
      await expect(page.locator("[data-view=players]")).toHaveAttribute("data-design", design);
      await page.getByLabel("Buscar jugador").fill("quex");
      await expect(page.locator(".pl-count")).toHaveText("1 jugador");
      await page.locator(".pl-ed-row, .pl-cc-card").first().click();
      await expect(page.locator("[data-view=player]")).toBeVisible();
      await expect(page.locator(".pv-card .fifa-card, .pv-card [class*=fifa]").first()).toBeVisible();
      await expect(page.locator("[data-view=player] .pf-tiles")).toHaveCount(1); // stats shown once (no duplicates)
      await expect(page.locator("#pv-stats-title")).toBeVisible();
      await noOverflow(page);
      await page.locator(".mdd-back").first().click();
      await expect(page.locator("[data-view=players]")).toBeVisible();
    });

    test("ranking and Mi FIFA identity page", async ({ page }) => {
      await enterDemo(page, design, "gold");
      await nav(page, "Jugadores");
      await page.locator(".pl-tabs button", { hasText: "Ranking" }).click();
      await expect(page.locator("[data-view=ranking] .rk-table tbody tr").first()).toBeVisible();
      await noOverflow(page);
      await nav(page, "Mi FIFA");
      await expect(page.locator("[data-view=mi-fifa]")).toHaveAttribute("data-design", design);
      await expect(page.locator(".mf-card .md-btn", { hasText: /Cambiar foto/ })).toBeVisible();
      await expect(page.locator("#mf-edit-title")).toBeVisible();
      await expect(page.locator("#mf-evo-title")).toBeVisible();
      await expect(page.locator(".md-appearance-shortcut")).toBeVisible(); // Apariencia access preserved
      await noOverflow(page);
    });
  });
}

test("player role (demo simulator) hides admin tools and private data of others", async ({ page }) => {
  await enterDemo(page, "editorial");
  const roleSelect = page.locator("select").filter({ has: page.locator("option", { hasText: /Jugador/ }) }).first();
  if (await roleSelect.count()) {
    const opts = await roleSelect.locator("option").allTextContents();
    const player = opts.find((o) => /Jugador/.test(o) && !/Guille/.test(o));
    if (player) await roleSelect.selectOption({ label: player });
  }
  await nav(page, "Jugadores");
  await expect(page.locator(".pl-tabs button", { hasText: "Subgrupos" })).toHaveCount(0);
  await page.getByLabel("Buscar jugador").fill("quex");
  await page.locator(".pl-ed-row").first().click();
  await expect(page.getByRole("button", { name: /Desactivar jugador/ })).toHaveCount(0);
  await expect(page.getByText("Datos privados")).toHaveCount(0);
});
