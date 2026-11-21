import { test, expect } from "@playwright/test";

// F5 Radar MVP — discovery, request, my requests, admin panel/inbox, bell, settings. Local demo only
// (in-memory Radar API from src/dev/radarDemo.js; never part of production builds).
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
const ADMIN_MATCH = "e62c1146-24be-47a3-83f1-778848d7d102";

for (const design of ["editorial", "command"]) {
  test.describe(`Radar — ${design}`, () => {
    test("discover, request a spot and follow my requests", async ({ page }) => {
      await enterDemo(page, design);
      await go(page, "/radar");
      const view = page.locator("[data-view=radar]");
      await expect(view).toHaveAttribute("data-design", design);
      await expect(page.locator(".rd-item")).toHaveCount(4);
      await expect(page.locator(".rd-item").first()).toContainText("<2 km");
      await noOverflow(page);
      await page.locator(".rd-item", { hasText: "Complejo Mixco" }).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toContainText("Cancelación");
      await expect(sheet).not.toContainText("Av. "); // no address before approval
      await sheet.getByLabel("Posición").selectOption("Defender");
      await sheet.getByLabel(/Mensaje para el organizador/).fill("Juego de central.");
      await sheet.getByRole("button", { name: /Solicitar cupo/ }).click();
      await expect(sheet.locator(".rd-mine")).toContainText("Pendiente");
      await noOverflow(page);
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await tab(page, "Mis partidos");
      const approved = page.locator(".rd-req[data-status=approved]");
      await expect(approved).toContainText("Av. Las Américas");
      await approved.getByRole("button", { name: /Ver jugadores/ }).click();
      await expect(approved.locator(".rd-people li.is-me")).toHaveCount(1);
      await expect(page.locator(".rd-req[data-status=pending]")).toHaveCount(2);
      await approved.getByRole("button", { name: /Cancelar mi cupo/ }).click();
      await expect(approved.getByRole("alertdialog")).toBeVisible();
      await approved.getByRole("button", { name: /Volver/ }).click();
      await noOverflow(page);
    });

    test("admin publishes and answers requests from the match", async ({ page }) => {
      await enterDemo(page, design, "gold");
      await go(page, `/partidos/${ADMIN_MATCH}`);
      const panel = page.locator("[data-radar-panel]");
      await expect(panel).toContainText("En Radar · Abierta");
      await expect(panel.locator(".rd-inbox-item[data-status=pending]")).toHaveCount(2);
      await panel.getByRole("button", { name: "Aceptar a Gato Ruiz" }).click();
      await expect(panel).toContainText("Gato Ruiz se sumó al partido.");
      await panel.getByRole("button", { name: "Rechazar a Pibe Morales" }).click();
      await panel.getByLabel("Nota (opcional)").fill("Ya completamos");
      await panel.getByRole("button", { name: /^Rechazar$/ }).click();
      await expect(panel.locator(".rd-inbox-item[data-status=pending]")).toHaveCount(0);
      await panel.getByRole("button", { name: "Editar" }).click();
      await expect(panel.getByLabel("Cupos para Radar")).toBeVisible();
      await noOverflow(page);
    });

    test("bell and group switch", async ({ page }) => {
      await enterDemo(page, design);
      const bell = page.getByRole("button", { name: /Notificaciones: 2 sin leer/ }).locator("visible=true").first();
      await bell.click();
      await expect(page.locator(".rd-bell-pop:visible")).toContainText("Te aceptaron en Radar");
      await page.locator(".rd-bell-pop:visible").getByText("Te aceptaron en Radar").click();
      await expect(page.locator("[data-view=radar]")).toBeVisible();
      await expect(page.locator(".pl-tabs button.is-on")).toContainText("Mis partidos");
      await go(page, "/grupos");
      await tab(page, "Configuración");
      const card = page.locator(".rd-settings");
      await expect(card.getByLabel(/Permitir publicar partidos en Radar/)).toBeChecked();
      await noOverflow(page);
    });
  });
}

test("player role: Radar available, no admin Radar panel", async ({ page }) => {
  await enterDemo(page, "editorial");
  const roleSelect = page.locator("select").filter({ has: page.locator("option", { hasText: /Jugador/ }) }).first();
  test.skip(!(await roleSelect.count()), "demo role simulator not available");
  const opts = await roleSelect.locator("option").allTextContents();
  await roleSelect.selectOption({ label: opts.find((t) => /Jugador/.test(t)) });
  await go(page, `/partidos/${ADMIN_MATCH}`);
  await expect(page.locator("[data-view=match-detail]")).toBeVisible();
  await expect(page.locator("[data-radar-panel]")).toHaveCount(0);
  await go(page, "/radar");
  await expect(page.locator(".rd-item")).toHaveCount(4);
});
