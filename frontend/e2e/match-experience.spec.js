import { test, expect } from "./local-demo.js";

// Entrega 1 — match experience. Isolated demo mode only (local data, no backend writes).
const capturePalette = process.env.F5_CAPTURE_PALETTE;

async function enterDemo(page, design) {
  await page.addInitScript(pref => localStorage.setItem("f5_appearance_v1", JSON.stringify(pref)), { design, palette: capturePalette || "neon", updatedAt: 1 });
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

    test("player opens the FIFA card; stats modal edits and closes with Escape", async ({ page }, info) => {
      await enterDemo(page, design);
      await openDetail(page);
      await page.locator("#equipos .mdd-team li button").first().click();
      await expect(page.locator(".fifa-modal-overlay")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator(".fifa-modal-overlay")).toHaveCount(0);
      await page.getByRole("button", { name: /Cargar estadísticas/ }).click();
      await expect(page.getByRole("dialog", { name: /Estadísticas del partido/ })).toBeVisible();
      const row = page.locator(".mdd-stats-rows li").last();
      await row.getByLabel("Sumar Goles").click();
      await row.getByLabel("Sumar Asist.").click();
      await row.getByLabel("MVP", { exact: true }).check();
      await row.getByLabel("Valla", { exact: true }).check();
      await expect(row.getByLabel("MVP")).toBeChecked();
      await expect(row.getByLabel("Valla")).toBeChecked();
      await expect(row.locator(".mdd-stepper b")).toHaveText(["1", "1"]);
      await page.screenshot({ path: info.outputPath("estadisticas.png") });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: /Estadísticas del partido/ })).toHaveCount(0);
      if (capturePalette) {
        await expect(page.locator("html")).toHaveAttribute("data-f5-palette", capturePalette);
        await page.getByRole("button", { name: /Cargar estadísticas/ }).click();
        await page.getByRole("button", { name: /Guardar estadísticas/ }).click();
        for (const [name, selector] of [
          ["resumen", ".post-match-card"], ["clima", ".weather-widget .weather-info"], ["rendimiento", ".self-performance"],
        ]) {
          await expect(page.locator(selector)).toBeVisible();
          const panel = page.locator(name === "clima" ? ".weather-widget" : selector);
          await panel.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
          await expect(panel.getByRole("button").last()).toBeInViewport();
          await panel.getByRole("button").last().click({ trial: true });
          await panel.screenshot({ path: info.outputPath(name + ".png") });
        }
      }
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

for (const design of ["editorial", "command"]) {
  test(design + " simula dieciocho jugadores y completa la encuesta local", async ({ page }, info) => {
    await page.addInitScript(pref => localStorage.setItem("f5_appearance_v1", JSON.stringify(pref)), { design, palette: capturePalette || "gold", updatedAt: 1 });
    await page.goto("/?f5-match-demo");
    if (capturePalette) await expect(page.locator("html")).toHaveAttribute("data-f5-palette", capturePalette);
    await page.getByText("Todos", { exact: true }).click();
    await page.getByRole("button", { name: "Simular", exact: true }).click();
    await expect(page.locator(".mdd-team li")).toHaveCount(18);
    const team = page.locator(".mdd-team").first();
    await team.getByLabel("Color Morado").click();
    await expect(team.getByLabel("Color Morado")).toHaveClass(/is-selected/);
    await page.locator(".msim-result").screenshot({ path: info.outputPath("pizarra.png") });
    await team.locator("li button").first().click();
    await expect(page.locator(".fifa-modal-overlay")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByText("Abrir encuesta de práctica").click();
    await page.getByText("Siguiente").click();
    const rating = page.getByRole("group", { name: "Calificación para Jugador 2", exact: true });
    await rating.getByLabel("4 estrellas").click();
    await expect(rating.locator("[aria-pressed=true]")).toHaveCount(4);
    await page.screenshot({ path: info.outputPath("encuesta.png") });
    await page.getByText("Finalizar encuesta").click();
    await expect(page.getByRole("status")).toContainText("Gracias");
  });
}
