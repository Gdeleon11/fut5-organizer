import { test, expect } from "@playwright/test";
import { createMockDb, mockSupabase } from "./mock-supabase.js";

/* Radar discovery with Radar OFF for the group (as in Production): welcome, empty state,
 * organizer guidance and the privacy review. Nothing is enabled without explicit consent. */
test.use({ baseURL: "http://127.0.0.1:5175" });

async function start(context, page, role) {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    return route.abort();
  });
  const db = createMockDb();
  db.group_members[0].role = role;
  await mockSupabase(context, db);
  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();
  await expect(page.getByText("Jueves de fútbol").first()).toBeVisible({ timeout: 15000 });
  return db;
}

async function openRadar(page) {
  const mobileShortcut = page.locator(".md-mobile-top .rd-top-radar");
  if (await mobileShortcut.isVisible()) await mobileShortcut.click();
  else await page.locator(".md-sidebar, aside").getByRole("button", { name: /^Radar$/ }).first().click();
  await expect(page.getByRole("heading", { name: "Radar", level: 1 })).toBeVisible();
}

test("player: welcome, clear empty state, dismiss is remembered", async ({ context, page }) => {
  await start(context, page, "player");
  await openRadar(page);
  await expect(page.getByRole("heading", { name: "Bienvenido a Radar" })).toBeVisible();
  await expect(page.locator("[data-radar-empty=none]")).toContainText("Todavía no hay partidos publicados en Radar");
  await expect(page.locator("[data-radar-organizer]")).toHaveCount(0);
  await page.getByRole("button", { name: "Entendido" }).click();
  await expect(page.locator("[data-radar-welcome]")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Radar", level: 1 })).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-radar-welcome]")).toHaveCount(0);

  await page.getByLabel("Nivel").selectOption("competitivo");
  await expect(page.locator("[data-radar-empty=filtered]")).toBeVisible();
  await page.getByRole("button", { name: /Ver todas las zonas/ }).click();
  await expect(page.locator("[data-radar-empty=none]")).toBeVisible();
});

test("super admin: Radar off → privacy review → nothing enabled until confirmed", async ({ context, page }) => {
  const db = await start(context, page, "super_admin");
  await openRadar(page);
  const card = page.locator("[data-radar-organizer=off]");
  await expect(card).toContainText("Radar apagado");
  await card.getByRole("button", { name: "Revisar privacidad y activar" }).click();

  await expect(page.locator("#radar-settings")).toBeVisible();
  await page.getByLabel(/Permitir publicar partidos en Radar/).click({ force: true });
  await expect(page.getByRole("heading", { name: "Antes de activar Radar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activar Radar" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect((db.rpcs || []).filter((r) => r.fn === "radar_set_group_settings")).toHaveLength(0);
  expect(db.writes.filter((w) => w.table.startsWith("radar_"))).toHaveLength(0);
});

test("admin (not super admin) sees who can enable it, no settings link", async ({ context, page }) => {
  await start(context, page, "admin");
  await openRadar(page);
  const card = page.locator("[data-radar-organizer=off]");
  await expect(card).toContainText("Solo el super admin del grupo puede activarlo");
  await expect(card.getByRole("button")).toHaveCount(0);
});
