import { test, expect } from "@playwright/test";

// Entrega 1 — match experience. Isolated demo mode only (local data, no backend writes).
async function enterDemo(page, design) {
  await page.addInitScript((d) => localStorage.setItem("f5_appearance_v1", JSON.stringify({ design: d, palette: "neon", updatedAt: 1 })), design);
  await page.goto("/login");
  await page.getByRole("button", { name: /demo|demostración/i }).click();
  await expect(page.locator("[data-design]")).toBeVisible();
}
async function openDetail(page) {
  await page.locator(".mde-actions .md-btn-primary:visible, .mdc-acts .mdc-cta:visible, .mdc-dock .mdc-cta:visible").first().click();
  await expect(page.locator("[data-view=match-detail]")).toBeVisible();
}

for (const design of ["editorial", "command"]) {
  test.describe(`Experiencia de partido — ${design}`, () => {
    test("detail shows hero, roster, teams and venue with the chosen design", async ({ page }) => {
      await enterDemo(page, design);
      await openDetail(page);
      await expect(page.locator("[data-view=match-detail]")).toHaveAttribute("data-design", design);
      await expect(page).toHaveURL(/\/partidos\//);
      await expect(page.locator(design === "command" ? ".mdc-arena" : ".mde-hero")).toBeVisible();
      const roster = page.locator("#convocatoria");
      await expect(roster).toContainText("Guille");
      await expect(roster).toContainText(/7\/15 confirmados/);
      await expect(page.locator("#equipos .mdd-team")).toHaveCount(2);
      if (design === "command") await expect(page.locator("#equipos .mdd-pitch")).toBeVisible();
      await expect(page.locator("#cancha")).toContainText("Plaza 1 - Sintética");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      expect(overflow).toBe(false);
    });

    test("player opens the FIFA card; stats modal opens and closes with Escape", async ({ page }) => {
      await enterDemo(page, design);
      await openDetail(page);
      await page.locator("#equipos .mdd-team li button").first().click();
      await expect(page.locator(".fifa-modal-overlay")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator(".fifa-modal-overlay")).toHaveCount(0);
      await page.getByRole("button", { name: /Cargar estadísticas/ }).click();
      await expect(page.getByRole("dialog", { name: /Estadísticas del partido/ })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: /Estadísticas del partido/ })).toHaveCount(0);
    });

    test("back to Partidos, create form groups and tactical board", async ({ page }) => {
      await enterDemo(page, design);
      await openDetail(page);
      await page.locator(".mdd-back").first().click();
      await expect(page.locator("[data-design]")).toBeVisible();
      await page.locator("button:visible", { hasText: /^Nuevo partido$/ }).first().click();
      await expect(page.locator(".md-form legend")).toHaveText(["Cuándo y dónde", "Cupos y costo"]);
      await expect(page.locator(".md-form button[type=submit]")).toHaveText("Crear partido");
      await page.locator(".md-form-actions button", { hasText: "Cancelar" }).click();
      await page.locator("button:visible", { hasText: /Pizarra táctica/ }).first().click();
      await expect(page.locator(`[data-view=pizarra][data-design=${design}]`)).toBeVisible();
      await page.locator("button:visible", { hasText: /^Todos$/ }).first().click();
      await expect(page.locator(".msim-count b")).toHaveText("7");
      await expect(page.getByRole("button", { name: "Simular", exact: true })).toBeDisabled(); // demo has 7 < 10 players
    });
  });
}
