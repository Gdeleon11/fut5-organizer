import { test, expect } from "@playwright/test";
import { createMockDb, mockSupabase } from "./mock-supabase.js";

/* Command Center pitch: Mi FIFA photo as a round token, initials fallback, tap opens the card. */
test.use({ baseURL: "http://127.0.0.1:5175" });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("photo on the pitch, initials fallback, card on tap", async ({ context, page }) => {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    if (u.hostname === "avatars.mock.test") return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return route.abort();
  });
  const db = createMockDb({ design: "command" });
  db.profiles[0].avatar_url = "https://avatars.mock.test/me.png";
  const other = { id: "55555555-5555-4555-8555-555555555555", full_name: "Rulo Mock", nickname: "Rulo", phone: null, preferred_position: "Forward", avatar_url: "https://avatars.mock.test/broken.png", group_tags: [], is_active: true };
  db.profiles.push(other);
  db.group_members.push({ id: "gm-2", group_id: db.group.id, profile_id: other.id, role: "player", is_active: true, created_at: "2026-01-02T00:00:00Z", groups: db.group, profiles: other });
  db.attendances.push(
    { id: "att-me", match_id: "33333333-3333-4333-8333-333333333333", profile_id: db.user.id, status: "confirmed", checked_in: false, created_at: "2026-01-01T00:00:00Z" },
    { id: "att-rulo", match_id: "33333333-3333-4333-8333-333333333333", profile_id: other.id, status: "confirmed", checked_in: false, created_at: "2026-01-01T00:01:00Z" },
  );
  await context.route("https://avatars.mock.test/broken.png", (r) => r.fulfill({ status: 404, body: "" }));
  await mockSupabase(context, db);

  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();

  const me = page.getByRole("button", { name: "Ver ficha de Mock" });
  await expect(me).toBeVisible({ timeout: 15000 });
  await expect(me.locator("img.pf-img")).toHaveAttribute("loading", "lazy");
  await expect.poll(() => me.locator("img.pf-img").evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  const shape = await me.locator("img.pf-img").evaluate((img) => getComputedStyle(img).borderRadius + "|" + getComputedStyle(img).objectFit);
  expect(shape).toBe("50%|cover");

  // Broken photo falls back to the initial.
  const rulo = page.getByRole("button", { name: "Ver ficha de Rulo" });
  await expect(rulo.locator(".pf-initial")).toHaveText("R");

  await rulo.click();
  await expect(page.getByRole("dialog", { name: /Carta de Rulo Mock/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Carta de/ })).toHaveCount(0);
});
