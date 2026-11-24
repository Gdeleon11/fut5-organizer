import { test, expect } from "@playwright/test";
import { createMockDb, mockSupabase } from "./mock-supabase.js";

/* The post-match survey opens once after a played match and stays closed after the X. */
test.use({ baseURL: "http://127.0.0.1:5175" });

test("closing the survey with X does not reopen it", async ({ context, page }) => {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    return route.abort();
  });
  const db = createMockDb();
  const yesterday = new Date(Date.now() - 864e5 - 6 * 3600e3).toISOString().slice(0, 10);
  const past = { id: "66666666-6666-4666-8666-666666666666", group_id: db.group.id, title: "Jueves pasado", venue: "Domo", status: "upcoming", max_players: 10, court_cost: 0, match_date: yesterday, start_time: "19:00", allowed_tags: [] };
  db.matches.push(past);
  db.attendances.push({ id: "att-past", match_id: past.id, profile_id: db.user.id, status: "confirmed", checked_in: false, created_at: "2026-01-01T00:00:00Z" });
  db.postmatchSummary = { participants: [db.user.id, "55555555-5555-4555-8555-555555555555"], events: [], corrections: [], history: [], mvp: { participants: 2, voters: 0, quorum: 3, leaders: [] }, my_vote: null, closed: null };
  await mockSupabase(context, db);
  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();

  const survey = page.getByRole("dialog", { name: "Jueves pasado" });
  await expect(survey).toBeVisible({ timeout: 15000 });
  await survey.getByRole("button", { name: "Cerrar encuesta" }).click();
  await expect(survey).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog", { name: "Jueves pasado" })).toHaveCount(0);
  // Navigating inside the app does not bring it back either.
  await page.goto("/perfil");
  await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog", { name: "Jueves pasado" })).toHaveCount(0);
  expect(db.writes.filter((w) => w.table === "match_player_stats")).toHaveLength(0);
});
