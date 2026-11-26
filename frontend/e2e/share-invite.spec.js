import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createMockDb, mockSupabase } from "./mock-supabase.js";

test.use({ baseURL: "http://127.0.0.1:5175" });

const CAPTURE_DIR = path.resolve(process.cwd(), "share-captures");

async function blockOthers(context) {
  await context.route("**/*", (route) => {
    const raw = route.request().url();
    if (raw.startsWith("blob:") || raw.startsWith("data:")) return route.fallback();
    const u = new URL(raw);
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    return route.abort();
  });
}

function seedShareScenario(db) {
  db.group.name = "Chamusca Privada Jueves";
  db.group_members[0].role = "admin";
  db.profiles[0].full_name = "Guillermo Alejandro De León Ramírez";
  db.profiles[0].nickname = "Guille";
  db.profiles[0].phone = "+502 5555-8888";
  db.profiles[0].preferred_position = "Midfielder";

  // Add 11 extra players (total 12 -> 6 vs 6) including long names
  const extraPlayers = Array.from({ length: 11 }, (_, i) => ({
    id: `77777777-7777-4777-8777-7777777700${String(i + 1).padStart(2, "0")}`,
    full_name: i === 0 ? "Sebastián Alejandro Montemayor Villanueva" : `Jugador ${i + 2}`,
    nickname: i === 0 ? "Seba Montemayor" : null,
    phone: `5555-00${i}`,
    preferred_position: i === 0 || i === 6 ? "Goalkeeper" : i % 2 === 0 ? "Forward" : "Defender",
    avatar_url: null,
    group_tags: [],
    is_active: true,
  }));
  extraPlayers.forEach((p, idx) => {
    db.profiles.push(p);
    db.group_members.push({
      id: `gm-extra-${idx}`,
      group_id: db.group.id,
      profile_id: p.id,
      role: "player",
      is_active: true,
      created_at: "2026-01-02T00:00:00Z",
      groups: db.group,
      profiles: p,
    });
  });

  const openMatch = db.matches[0];
  openMatch.title = "Chamusca Nocturna de los Jueves en Zona 14";
  openMatch.venue = "Futeca Cayalá Cancha 3";
  openMatch.max_players = 14;

  // Confirm 12 players on openMatch
  db.attendances = [db.profiles[0], ...extraPlayers].map((p, i) => ({
    id: `att-open-${i}`,
    match_id: openMatch.id,
    group_id: db.group.id,
    profile_id: p.id,
    status: "confirmed",
    checked_in: false,
    created_at: `2026-11-20T10:${String(i).padStart(2, "0")}:00Z`,
  }));

  // 2 teams of 6 players each
  const all12 = [db.profiles[0], ...extraPlayers];
  db.teams = [
    {
      id: "team-a",
      match_id: openMatch.id,
      group_id: db.group.id,
      name: "Equipo Verde",
      color: "#5be584",
      total_rating: 22,
      team_members: all12.slice(0, 6).map((p, i) => ({
        id: `tm-a-${i}`,
        team_id: "team-a",
        profile_id: p.id,
        profiles: p,
      })),
    },
    {
      id: "team-b",
      match_id: openMatch.id,
      group_id: db.group.id,
      name: "Equipo Azul",
      color: "#6cb4ff",
      total_rating: 21,
      team_members: all12.slice(6, 12).map((p, i) => ({
        id: `tm-b-${i}`,
        team_id: "team-b",
        profile_id: p.id,
        profiles: p,
      })),
    },
  ];

  // Closed match WITHOUT official MVP (edge case)
  const closedMatch = {
    id: "99999999-9999-4999-8999-999999999991",
    group_id: db.group.id,
    title: "Clásico del Domingo",
    match_date: "2026-11-15",
    start_time: "18:00",
    venue: "Cancha Los Robles",
    max_players: 10,
    status: "closed",
  };
  db.matches.push(closedMatch);
  db.match_stats = [
    {
      id: "ms-1",
      match_id: closedMatch.id,
      group_id: db.group.id,
      player_id: db.profiles[0].id,
      goals: 3,
      assists: 2,
      mvp: false,
      clean_sheet: false,
    },
    {
      id: "ms-2",
      match_id: closedMatch.id,
      group_id: db.group.id,
      player_id: extraPlayers[0].id,
      goals: 2,
      assists: 1,
      mvp: false,
      clean_sheet: false,
    },
  ];
  return { openMatch, closedMatch };
}

async function loginMock(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();
  await expect(page.getByText(/Partidos|Chamusca Nocturna/i).first()).toBeVisible({ timeout: 15000 });
}

async function assertRealPngDownload(page, modal, saveAsName) {
  const img = modal.locator(".f5s-preview-img");
  await expect(img).toBeVisible({ timeout: 10000 });
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^blob:/);

  const dlLink = modal.locator('[data-share-action="download"]');
  await dlLink.scrollIntoViewIfNeeded();
  const dlPromise = page.waitForEvent("download", { timeout: 6000 });
  await dlLink.click({ timeout: 6000 });
  const download = await dlPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const dlPath = await download.path();
  const buf = fs.readFileSync(dlPath);
  // PNG magic header: 89 50 4E 47 0D 0A 1A 0A
  expect(buf.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.length).toBeGreaterThan(5000);

  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CAPTURE_DIR, saveAsName), buf);
}

test("Convocatoria, Equipos, Resultado (sin MVP) y Mi FIFA exportan PNG reales en móvil", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await blockOthers(context);
  const db = createMockDb();
  const { openMatch, closedMatch } = seedShareScenario(db);
  await mockSupabase(context, db);
  await loginMock(page);

  // 1. Open match detail -> Priority A (Convocatoria)
  await page.goto(`/partidos/${openMatch.id}`);
  await expect(page.getByTestId("match-share-btn")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("match-share-btn").click();

  const inviteModal = page.getByTestId("share-invite-modal");
  await expect(inviteModal).toBeVisible();
  // Group name must be hidden by default
  const inviteTextDefault = await inviteModal.locator(".f5s-text-preview pre").textContent();
  expect(inviteTextDefault).not.toContain("Chamusca Privada Jueves");
  expect(inviteTextDefault).toContain(`/partidos/${openMatch.id}?group=${db.group.id}`);
  expect(inviteTextDefault).not.toMatch(/admin|token|radar/i);

  // Admin enables group name toggle
  await inviteModal.getByLabel("Mostrar nombre del grupo").check();
  const inviteTextWithGroup = await inviteModal.locator(".f5s-text-preview pre").textContent();
  expect(inviteTextWithGroup).toContain("Chamusca Privada Jueves");

  await assertRealPngDownload(page, inviteModal, "convocatoria-neon-mobile.png");
  // Check no horizontal overflow on 390px mobile
  const overflowInvite = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflowInvite).toBe(false);
  await inviteModal.getByRole("button", { name: "Cerrar" }).click();

  // 2. Priority B (Equipos 6 vs 6, no ratings)
  await page.getByTestId("teams-share-btn").click();
  const teamsModal = page.getByTestId("share-teams-modal");
  await expect(teamsModal).toBeVisible();
  const teamsText = await teamsModal.locator(".f5s-text-preview pre").textContent();
  expect(teamsText).toContain("Equipo Verde (6)");
  expect(teamsText).toContain("Equipo Azul (6)");
  expect(teamsText).not.toMatch(/estrella|★|rating|5555/i);
  await assertRealPngDownload(page, teamsModal, "equipos-6v6-neon.png");
  await teamsModal.getByRole("button", { name: "Cerrar" }).click();

  // 3. Priority D (Resultado sin MVP oficial)
  await page.goto(`/partidos/${closedMatch.id}`);
  await expect(page.getByTestId("result-share-btn")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("result-share-btn").click();
  const resultModal = page.getByTestId("share-result-modal");
  await expect(resultModal).toBeVisible();
  const resultText = await resultModal.locator(".f5s-text-preview pre").textContent();
  expect(resultText).not.toContain("MVP");
  expect(resultText).toContain("Clásico del Domingo");
  await assertRealPngDownload(page, resultModal, "resultado-sin-mvp-neon.png");
  await resultModal.getByRole("button", { name: "Cerrar" }).click();

  // 4. Priority C (Mi FIFA — owner-controlled, missing photo fallback, no phone)
  await page.getByRole("button", { name: "Más" }).click();
  await page.getByRole("button", { name: /Mi FIFA/i }).first().click();
  await expect(page.getByTestId("fifa-share-btn")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("fifa-share-btn").click();
  const fifaModal = page.getByTestId("share-fifa-modal");
  await expect(fifaModal).toBeVisible();
  const fifaText = await fifaModal.locator(".f5s-text-preview pre").textContent();
  expect(fifaText).toContain("Guille");
  expect(fifaText).not.toContain("5555-8888");
  await assertRealPngDownload(page, fifaModal, "mi-fifa-sin-foto-neon.png");
  await fifaModal.getByRole("button", { name: "Cerrar" }).click();
});

test("Exportación PNG funciona en ambas experiencias y las 4 paletas", async ({ context, page }) => {
  await blockOthers(context);
  const db = createMockDb();
  const { openMatch } = seedShareScenario(db);
  await mockSupabase(context, db);
  await loginMock(page);

  const combos = [
    { design: "editorial", palette: "light", file: "convocatoria-editorial-light.png" },
    { design: "command", palette: "midnight", file: "convocatoria-command-midnight.png" },
    { design: "command", palette: "gold", file: "convocatoria-command-gold.png" },
  ];

  for (const combo of combos) {
    await page.evaluate(({ design, palette }) => {
      window.localStorage.setItem(
        "f5_appearance_v1",
        JSON.stringify({ design, palette, updatedAt: Date.now(), userId: null }),
      );
      document.documentElement.dataset.design = design;
      document.documentElement.dataset.palette = palette;
    }, combo);

    await page.goto(`/partidos/${openMatch.id}`);
    await expect(page.getByTestId("match-share-btn")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("match-share-btn").click();
    const modal = page.getByTestId("share-invite-modal");
    await assertRealPngDownload(page, modal, combo.file);
    await modal.getByRole("button", { name: "Cerrar" }).click();
  }
});

test("Enlace de invitación funciona para usuario sin cuenta y usuario con sesión", async ({ context, page }) => {
  await blockOthers(context);
  const db = createMockDb();
  const { openMatch } = seedShareScenario(db);
  db.publicGroups = [{ id: db.group.id, name: db.group.name }];
  await mockSupabase(context, db);

  const invitePath = `/partidos/${openMatch.id}?group=${db.group.id}`;

  // Signed-out visitor sees invitation context + sign-up CTA
  await page.goto(invitePath);
  await expect(page.getByText(/Te invitaron/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("form.auth-form button[type=submit]")).toHaveText(/Crear mi cuenta/);

  // Signed-in user lands directly on the match detail
  await loginMock(page);
  await page.goto(invitePath);
  await expect(page.getByTestId("match-share-btn")).toBeVisible({ timeout: 15000 });
});
