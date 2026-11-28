import { test, expect } from "@playwright/test";
import { createMockDb, mockSupabase } from "./mock-supabase.js";

/* Commercial onboarding V1: entry, Spanish auth errors, password recovery, invitation context and
 * the first-steps cards an organizer sees on Partidos. Mock Supabase only (no real data). */
test.use({ baseURL: "http://127.0.0.1:5175" });

async function blockOthers(context) {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    return route.abort();
  });
}

test("signed-out visitor sees the landing with sign-up and sign-in", async ({ context, page }) => {
  await blockOthers(context);
  await mockSupabase(context);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Crear mi grupo gratis/ }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/\+10[.,]000|99[.,]4%/)).toHaveCount(0);
  await page.getByRole("button", { name: /Crear mi grupo gratis/ }).first().click();
  await expect(page.locator("form.auth-form button[type=submit]")).toHaveText(/Crear mi cuenta/);
});

test("wrong password shows a Spanish error and recovery stays neutral", async ({ context, page }) => {
  await blockOthers(context);
  const db = createMockDb();
  db.authError = "Invalid login credentials";
  await mockSupabase(context, db);
  await page.goto("/login");
  await page.getByLabel("Email").fill("nadie@example.test");
  await page.getByLabel("Contraseña").fill("incorrecta-1");
  await page.locator("form.auth-form button[type=submit]").click();
  await expect(page.getByRole("alert")).toHaveText("Email o contraseña incorrectos.");

  await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
  await page.getByLabel("Email").fill("nadie@example.test");
  await page.locator("form.auth-form button[type=submit]").click();
  await expect(page.getByText(/Si existe una cuenta|te enviamos|revisá tu correo/i).first()).toBeVisible();
  expect(db.recoverRequests).toBe(1);
});

test("invitation link shows the group name, or explains an invalid link", async ({ context, page }) => {
  await blockOthers(context);
  const db = createMockDb();
  db.publicGroups = [{ id: db.group.id, name: "Jueves Mock" }];
  await mockSupabase(context, db);
  await page.goto(`/login?group=${db.group.id}`);
  await expect(page.getByText(/Te invitaron a «Jueves Mock»/)).toBeVisible({ timeout: 15000 });
  await expect(page.locator("form.auth-form button[type=submit]")).toHaveText(/Crear mi cuenta/);

  db.publicGroupsError = true; // real Supabase: signed-out visitors cannot search groups
  await page.goto(`/partidos/${db.matches[0].id}?group=${db.group.id}`);
  await expect(page.getByText(/Te invitaron a un grupo de F5 Manager/)).toBeVisible({ timeout: 15000 });
  db.publicGroupsError = false;

  await page.goto("/login?group=00000000-0000-4000-8000-000000000000");
  await expect(page.getByText(/enlace de invitación no es válido|no encontramos/i).first()).toBeVisible({ timeout: 15000 });
});

test("organizer sees invite + pending activation cards and activates with one tap", async ({ context, page }) => {
  await blockOthers(context);
  const db = createMockDb();
  db.group_members[0].role = "admin";
  const friend = { id: "66666666-6666-4666-8666-666666666666", full_name: "Amigo Nuevo", nickname: null, phone: null, preferred_position: null, avatar_url: null, group_tags: [], is_active: true };
  db.profiles.push(friend);
  db.group_members.push({ id: "gm-2", group_id: db.group.id, profile_id: friend.id, role: "player", is_active: false, created_at: "2026-01-02T00:00:00Z", groups: db.group, profiles: friend });
  await mockSupabase(context, db);
  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();

  const pending = page.locator('[data-onboarding-card="pending"]');
  await expect(pending).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-onboarding-card="invite"] a[href*="wa.me"], [data-onboarding-card="invite"] a[href*="whatsapp"]')).toHaveCount(1);
  await pending.getByRole("button", { name: /Activar a Amigo/ }).click();
  await expect.poll(() => db.writes.some((w) => w.table === "group_members" && w.method === "PATCH" && w.body?.is_active === true)).toBe(true);
});
