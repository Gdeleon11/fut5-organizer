import { test, expect } from "@playwright/test";
import { createMockDb, mockSupabase } from "./mock-supabase.js";

/* Signed-in startup: login, reload, direct links. Runs against the "auth" dev server built with a
 * mock Supabase origin (no real database), so every request is answered by e2e/mock-supabase.js. */
test.use({ baseURL: "http://127.0.0.1:5175" });

async function blockOthers(context) {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    return route.abort();
  });
}

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();
}

async function expectDashboard(page) {
  await expect(page.getByText("Jueves de fútbol").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-startup]")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/partidos");
}

test.describe("signed-in startup", () => {
  test("login lands on the dashboard without pressing Partidos", async ({ context, page }) => {
    await blockOthers(context);
    await mockSupabase(context);
    await login(page);
    await expectDashboard(page);
  });

  test("reload on /partidos and visiting / while signed in show the dashboard", async ({ context, page }) => {
    await blockOthers(context);
    await mockSupabase(context);
    await login(page);
    await expectDashboard(page);

    await page.reload();
    await expectDashboard(page);

    await page.goto("/");
    await expectDashboard(page);
  });

  test("direct link to an unknown match explains it and shows the list", async ({ context, page }) => {
    await blockOthers(context);
    await mockSupabase(context);
    await login(page);
    await expectDashboard(page);
    await page.goto("/partidos/00000000-0000-4000-8000-000000000000");
    await expectDashboard(page);
    await expect(page.getByText("Ese partido no está disponible en tu grupo activo.")).toBeVisible();
  });

  test("a failed load shows a recoverable error, and Reintentar recovers", async ({ context, page }) => {
    await blockOthers(context);
    const db = createMockDb();
    await mockSupabase(context, db);
    await login(page);
    await expectDashboard(page);

    db.failNext.group_members = 1;
    await page.reload();
    await expect(page.locator("[data-startup=error]")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("alert")).toContainText("No pudimos cargar tu panel");
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expectDashboard(page);
  });
});
