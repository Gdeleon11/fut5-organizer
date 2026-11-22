import { test, expect } from "@playwright/test";
import { createMockDb, mockSupabase } from "./mock-supabase.js";

/* "+ Confirmarme" on the Próximos list: same handler as the match page, one request per tap. */
test.use({ baseURL: "http://127.0.0.1:5175" });

async function setup(context, page, design) {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    return route.abort();
  });
  const db = await mockSupabase(context, createMockDb({ design }));
  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();
  await expect(page.getByText("Sábado temprano").first()).toBeVisible({ timeout: 15000 });
  return db;
}

for (const design of ["editorial", "command"]) {
  test(`${design}: quick confirm updates the card and sends one request`, async ({ context, page }) => {
    const db = await setup(context, page, design);
    const quick = page.getByRole("button", { name: "Confirmarme en Sábado temprano" });
    await expect(quick).toBeVisible();
    await expect(page.getByText("1/10").first()).toBeVisible();

    // Slow the write down so the busy state is observable, then double-click.
    await context.route("http://supabase.mock.test/rest/v1/attendances**", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 600));
      return route.fallback();
    });
    await quick.dblclick();
    await expect(page.getByRole("button", { name: /Confirmando tu asistencia a Sábado temprano/ })).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "Asistencia confirmada." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmarme en Sábado temprano" })).toHaveCount(0);
    await expect(page.getByText("2/10").first()).toBeVisible();

    const posts = db.writes.filter((w) => w.table === "attendances" && w.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({ match_id: "44444444-4444-4444-8444-444444444444", status: "confirmed" });
  });
}

test("no quick confirm while the player owes money (finiquito)", async ({ context, page }) => {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    return route.abort();
  });
  const db = createMockDb();
  db.fines = [{ id: "fine-1", group_id: db.group.id, profile_id: db.user.id, amount: 25, status: "open", reason: "late_cancel", created_at: "2026-01-01T00:00:00Z" }];
  await mockSupabase(context, db);
  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();
  await expect(page.getByText("Sábado temprano").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /^Confirmarme en/ })).toHaveCount(0);
  expect(db.writes.filter((w) => w.table === "attendances")).toHaveLength(0);
});
