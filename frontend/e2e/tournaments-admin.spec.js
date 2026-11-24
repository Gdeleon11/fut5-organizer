import { test, expect } from "@playwright/test";

// Entrega 4 — Torneos (calendario, tabla, llaves, equipos, alta), Grupos/Roles y páginas públicas. Local demo only.
async function enterDemo(page, design, palette = "neon") {
  await page.addInitScript(({ d, p }) => localStorage.setItem("f5_appearance_v1", JSON.stringify({ design: d, palette: p, updatedAt: 1 })), { d: design, p: palette });
  await page.goto("/login");
  await page.getByRole("button", { name: /demo|demostración/i }).click();
  await expect(page.locator("[data-design]")).toBeVisible();
}
const go = (page, url) => page.evaluate((u) => { history.pushState({}, "", u); dispatchEvent(new PopStateEvent("popstate")); }, url);
const tab = (page, name) => page.locator(".pl-tabs button", { hasText: name }).first().click();
const noOverflow = async (page) => {
  const w = page.viewportSize().width;
  expect(await page.evaluate((vw) => document.documentElement.scrollWidth > vw + 1 || innerWidth > vw + 1, w)).toBe(false);
};

for (const design of ["editorial", "command"]) {
  test.describe(`Torneos y Grupos — ${design}`, () => {
    test("tournament list, fixtures, standings, bracket and teams", async ({ page }) => {
      await enterDemo(page, design);
      await go(page, "/torneos");
      await expect(page.locator("[data-view=tournaments]")).toHaveAttribute("data-design", design);
      await expect(page.locator(".tn-list-item")).toHaveCount(3);
      await page.locator(".tn-list-item", { hasText: "Liga Apertura" }).click();
      await expect(page.locator(".tn-round")).toHaveCount(5);
      await expect(page.getByRole("button", { name: /^Cargar resultado/ }).first()).toBeVisible(); // pending match editable
      await noOverflow(page);
      await tab(page, "Tabla");
      await expect(page.locator(".tn-table tbody tr")).toHaveCount(4);
      await expect(page.locator(".tn-table tbody tr").first()).toHaveClass(/is-leader/);
      await noOverflow(page);
      await tab(page, "Llaves");
      await expect(page.locator(".tn-col h3")).toHaveText(["Semifinales", "Final"]);
      await expect(page.locator(".tn-slot.is-win")).toHaveCount(2);
      // The final is fully inside the screen (phones stack rounds vertically instead of cutting it off).
      const finalBox = await page.locator(".tn-col").last().boundingBox();
      const vw = page.viewportSize().width;
      expect(finalBox.x).toBeGreaterThanOrEqual(0);
      expect(finalBox.x + finalBox.width).toBeLessThanOrEqual(vw + 1);
      await tab(page, "Equipos");
      await expect(page.locator(".tn-team-card")).toHaveCount(4);
      await page.locator(".tn-back").click();
      await page.locator(".tn-list-item", { hasText: "Torneo de Verano" }).click();
      await expect(page.locator(".tn-setup")).toBeVisible();
      await page.getByRole("button", { name: /Repartir parejo/ }).click();
      await expect(page.locator(".tn-assign")).toHaveCount(4);
      await noOverflow(page);
    });

    test("groups and roles matrix", async ({ page }) => {
      await enterDemo(page, design, "gold");
      await go(page, "/grupos");
      await expect(page.locator("[data-view=groups]")).toHaveAttribute("data-design", design);
      await expect(page.locator(".gr-list li.is-current")).toHaveCount(1);
      await expect(page.getByRole("button", { name: /Agregar descripción|Editar descripción/ })).toBeVisible();
      await noOverflow(page);
      await tab(page, "Roles y permisos");
      await expect(page.getByRole("table", { name: /Qué puede hacer cada rol/ })).toBeVisible();
      await expect(page.locator(".gr-roles li.is-mine")).toContainText("Super Admin");
      await noOverflow(page);
    });
  });
}

test("player role: Torneos is read-only and no group admin tools", async ({ page }) => {
  await enterDemo(page, "editorial");
  const roleSelect = page.locator("select").filter({ has: page.locator("option", { hasText: /Jugador/ }) }).first();
  test.skip(!(await roleSelect.count()), "demo role simulator not available");
  const opts = await roleSelect.locator("option").allTextContents();
  await roleSelect.selectOption({ label: opts.find((t) => /Jugador/.test(t)) });
  await go(page, "/torneos");
  await expect(page.locator("[data-view=tournaments]")).toBeVisible();
  await expect(page.getByRole("button", { name: /Nuevo campeonato/ })).toHaveCount(0);
  await go(page, "/grupos");
  // The simulator changes isAdmin only (membership.role stays as stored), so assert on the isAdmin-gated editor.
  await expect(page.getByRole("button", { name: /Agregar descripción|Editar descripción/ })).toHaveCount(0);
});

test("public reservation link uses the shared public identity", async ({ page }) => {
  await page.goto("/reserve/abc123");
  await expect(page.locator(".pub .pub-card")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-design]")).toHaveCount(0); // independent of the internal experiences
  await noOverflow(page);
});
