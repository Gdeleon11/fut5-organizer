import { test, expect } from "@playwright/test";

function visibleButton(page, name) {
  return page.locator("button:visible").filter({ hasText: name }).first();
}

async function openNavDestination(page, labelRegex) {
  const direct = page.locator("button:visible").filter({ hasText: labelRegex }).first();
  if (await direct.count()) {
    await direct.click();
    return;
  }
  const moreBtn = page.locator('button[title="Más opciones"]:visible').first();
  if (await moreBtn.count()) {
    await moreBtn.click();
    await page.locator("button:visible").filter({ hasText: labelRegex }).first().click();
  }
}

test.describe("F5 Manager — Security & Core Functional Regressions (Isolated Demo Mode)", () => {
  test("renders public entry, navigates to login, and enters isolated demo mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText(/f5manager/i);

    await page.goto("/login");
    const demoButton = page.getByRole("button", { name: /demo|demostración/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    await expect(page.locator("body")).toContainText("Partidos");
    await expect(page.locator("body")).toContainText("Plaza 1 - Sintética");
  });

  test("preserves navigation across all main tabs without pointer interception or redirect loops", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /demo|demostración/i }).click();
    await expect(page.locator("body")).toContainText("Plaza 1 - Sintética");

    // Navigate to Reservas (explicitly tests bottom-nav clickability on mobile)
    await visibleButton(page, /^Reservas$/).click({ timeout: 4000 });
    await expect(page).toHaveURL(/\/reservas/);

    // Navigate to Cobros (Finanzas / Cuotas / Multas)
    await visibleButton(page, /^Cobros$/).click();
    await expect(page).toHaveURL(/\/cobros-caja/);
    await expect(page.locator("body")).toContainText(/Caja y Finanzas/i);
    await visibleButton(page, /Cobros y Cuotas/i).click();
    await expect(page.locator("body")).toContainText(/Uniformes nuevos/i);
    await visibleButton(page, /Multas/i).click();

    // Navigate to Jugadores
    await visibleButton(page, /^Jugadores$/).click();
    await expect(page).toHaveURL(/\/jugadores/);
    await expect(page.locator("body")).toContainText("Guille");

    // Navigate to Mi FIFA (direct on desktop, via "Más" overflow menu on mobile)
    await openNavDestination(page, /^Mi FIFA$/);
    await expect(page).toHaveURL(/\/perfil/);

    // Navigate to Torneos (Super Admin in demo mode)
    await openNavDestination(page, /^Torneos$/);
    await expect(page).toHaveURL(/\/torneos/);
  });

  test("enforces role visibility when switching between Super Admin and Player in demo simulator", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /demo|demostración/i }).click();

    // Super Admin has access to Torneos (direct on desktop or inside "Más" on mobile)
    const torneosDirect = page.locator("button:visible").filter({ hasText: /^Torneos$/ });
    const moreBtn = page.locator("button:visible").filter({ hasText: /^Más$/ });
    if (await torneosDirect.count()) {
      await expect(torneosDirect.first()).toBeVisible();
    } else {
      await expect(moreBtn.first()).toBeVisible();
      await moreBtn.first().click();
      await expect(page.locator("button:visible").filter({ hasText: /^Torneos$/ }).first()).toBeVisible();
    }

    // Switch simulated role to Jugador via DevRoleBanner combobox
    const roleSelect = page.getByLabel("Simular Rol");
    await expect(roleSelect).toBeVisible();
    await roleSelect.selectOption({ label: "Javi B (Jugador)" });
    await expect(page.locator("button:visible").filter({ hasText: /^Torneos$/ })).toHaveCount(0);
    await expect(page.locator("button:visible").filter({ hasText: /^Más$/ })).toHaveCount(0);
  });

  test("opens Match Detail and shows attendances and generated teams", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /demo|demostración/i }).click();
    await expect(page.locator("body")).toContainText("Plaza 1 - Sintética");

    const openBtn = visibleButton(page, /Ver partido|Ver detalle|Abrir|Detalle|Gestionar/i);
    await expect(openBtn).toBeVisible();
    await openBtn.click();
    await expect(page).toHaveURL(/\/partidos\//);
    await expect(page.locator("body")).toContainText(/Equipos|Jugadores|Partido/i);
  });
});
