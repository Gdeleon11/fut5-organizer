import { test, expect } from "@playwright/test";

// Entrega 3 — Cobros (caja, cuotas, multas), Reservas (agenda/calendario/lista) y Sedes. Isolated local demo only:
// every action here mutates in-memory demo state, never Supabase.
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
const tab = (page, name) => page.locator(".pl-tabs button", { hasText: name }).first().click();
const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

for (const design of ["editorial", "command"]) {
  test.describe(`Cobros y Reservas — ${design}`, () => {
    test("treasury, fees with proof review, fines", async ({ page }) => {
      await enterDemo(page, design);
      await nav(page, "Cobros");
      const shell = page.locator("[data-view=cashier]");
      await expect(shell).toHaveAttribute("data-design", design);
      await expect(page.locator("[data-view=treasury]")).toBeVisible();
      await expect(page.locator(design === "command" ? ".fx-kpis.is-command" : ".fx-statement")).toBeVisible();
      await expect(page.locator(design === "command" ? ".fx-feed li" : ".fx-ledger tbody tr:not(.fx-month)").first()).toBeVisible();
      await page.locator(".fx-seg button", { hasText: /^Egresos$/ }).click();
      await expect(page.locator(".fx-count", { hasText: /movimientos/ })).toHaveText("2 movimientos");
      await noOverflow(page);

      await tab(page, "Cobros y cuotas");
      await expect(page.locator("[data-view=fees]")).toBeVisible();
      await page.locator(".fx-act.is-review").first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Revisar comprobante" })).toBeVisible();
      await dialog.getByRole("button", { name: "Rechazar" }).click();
      await expect(dialog.getByLabel(/Motivo del rechazo/)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await noOverflow(page);

      await tab(page, "Multas");
      await expect(page.locator("[data-view=fines]")).toBeVisible();
      await expect(page.getByRole("button", { name: "Marcar pagada" }).first()).toBeVisible();
      await noOverflow(page);
    });

    test("reservations calendar, cards, list and venues", async ({ page }) => {
      await enterDemo(page, design, "light");
      await nav(page, "Reservas");
      await expect(page.locator("[data-view=reservations]")).toHaveAttribute("data-design", design);
      await page.locator(".fx-seg button", { hasText: /^Calendario$/ }).click();
      await expect(page.locator(".rv-grid [role=gridcell]")).toHaveCount(42);
      await page.locator(".fx-seg button", { hasText: /^Tarjetas$/ }).click();
      await expect(page.locator(".rv-card").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirmar y crear partido" }).first()).toBeDisabled(); // proof first
      await page.locator(".fx-seg button", { hasText: /^Lista$/ }).click();
      await expect(page.locator(".rv-table")).toBeVisible();
      await page.locator(".rv-delegate .md-btn-accent").click();
      await expect(page.locator(".rv-form fieldset")).toHaveCount(1);
      await noOverflow(page);
      await tab(page, "Sedes y canchas");
      await expect(page.locator(".fx-venue")).toHaveCount(2);
      await noOverflow(page);
    });
  });
}

test("player role (demo simulator) sees own fees and no admin finance tools", async ({ page }) => {
  await enterDemo(page, "editorial");
  const roleSelect = page.locator("select").filter({ has: page.locator("option", { hasText: /Jugador/ }) }).first();
  test.skip(!(await roleSelect.count()), "demo role simulator not available");
  const opts = await roleSelect.locator("option").allTextContents();
  const player = opts.find((t) => /Jugador/.test(t));
  await roleSelect.selectOption({ label: player });
  await nav(page, "Cobros");
  await tab(page, "Cobros y cuotas");
  await expect(page.locator("[data-view=my-fees]")).toBeVisible();
  await expect(page.getByLabel("Marcar como pagado")).toHaveCount(0);
  await expect(page.getByLabel("Perdonar cuota")).toHaveCount(0);
  await tab(page, "Multas");
  await expect(page.getByRole("heading", { name: /Mis multas/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar pagada" })).toHaveCount(0);
  await tab(page, "Caja y finanzas");
  await expect(page.getByRole("form", { name: "Registrar egreso manual" })).toHaveCount(0);
});
