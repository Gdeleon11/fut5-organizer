import { test, expect } from "@playwright/test";
import { createMockDb, mockSupabase } from "./mock-supabase.js";

/* Friendly championship, end to end, as an organizer on a phone and on desktop (mock Supabase). */
test.use({ baseURL: "http://127.0.0.1:5175" });

async function start(context, page, { role = "super_admin", design = "editorial", seed } = {}) {
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === "http://127.0.0.1:5175" || u.hostname === "supabase.mock.test") return route.fallback();
    return route.abort();
  });
  const db = createMockDb({ design });
  db.group_members[0].role = role;
  // A few extra members to assign to teams.
  for (let i = 1; i <= 6; i += 1) {
    const p = { id: `00000000-0000-4000-8000-00000000000${i}`, full_name: `Jugador ${i}`, nickname: `Jug${i}`, phone: null, preferred_position: "Midfielder", avatar_url: null, group_tags: [], is_active: true };
    db.profiles.push(p);
    db.group_members.push({ id: `gm-x${i}`, group_id: db.group.id, profile_id: p.id, role: "player", is_active: true, created_at: "2026-01-02T00:00:00Z", groups: db.group, profiles: p });
  }
  seed?.(db);
  await mockSupabase(context, db);
  await page.goto("/login");
  await page.getByLabel("Email").fill("jugador@example.test");
  await page.getByLabel("Contraseña").fill("mock-password-1");
  await page.locator("form.auth-form button[type=submit]").click();
  await expect(page.getByText("Jueves de fútbol").first()).toBeVisible({ timeout: 15000 });
  await page.goto("/torneos");
  await expect(page.locator("[data-view=tournaments]")).toBeVisible({ timeout: 15000 });
  return db;
}

async function enterResult(page, name, home, away) {
  await page.getByRole("button", { name }).first().click();
  await page.getByLabel("Goles local").fill(String(home));
  await page.getByLabel("Goles visitante").fill(String(away));
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("form", { name: "Cargar resultado" })).toHaveCount(0);
}

for (const design of ["editorial", "command"]) {
  test(`${design}: organizer runs a Liga + Playoffs to a champion`, async ({ context, page }) => {
    const db = await start(context, page, { design });

    // 1–2. Create: name, format, teams, first date.
    await page.getByRole("button", { name: /Nuevo campeonato/ }).first().click();
    await page.getByLabel("Nombre").fill("Copa QA");
    await page.locator("label.tn-format", { hasText: "Liga + Playoffs" }).click();
    await page.getByLabel("Cantidad de equipos").selectOption("4");
    await page.getByLabel("Primer partido").fill("2026-12-01");
    await expect(page.getByText("Se juega los martes")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente: equipos" }).click();

    // 3–4. Teams (names) + optional players, then calendar in one step.
    const names = ["Leones", "Tigres", "Pumas", "Lobos"];
    for (let i = 0; i < 4; i += 1) await page.getByLabel(`Nombre del equipo ${i + 1}`).fill(names[i]);
    await page.getByRole("button", { name: "Repartir parejo" }).click();
    await page.getByRole("button", { name: "Crear equipos y calendario" }).click();

    // 5–6. Calendar: 3 matchdays + semifinals + final, empty knockout slots show their source.
    await expect(page.getByRole("heading", { name: "Jornada 1" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Jornada 3" })).toBeVisible();
    await expect(page.getByText("1º de la tabla").first()).toBeVisible();
    await expect(page.locator("[data-next-step]")).toContainText("Jornada 1");
    expect(db.tournament_matches).toHaveLength(9);
    expect(db.tournaments[0].status).toBe("active");
    expect(db.tournaments[0].match_day).toBe("tuesday");
    expect(db.tournament_team_members.length).toBeGreaterThan(0);

    // 7. Results: Leones win everything, Tigres beat Pumas and Lobos, Pumas–Lobos draw.
    const score = { "Leones-Tigres": [2, 0], "Leones-Pumas": [3, 1], "Leones-Lobos": [1, 0], "Tigres-Pumas": [2, 1], "Tigres-Lobos": [4, 0], "Pumas-Lobos": [1, 1] };
    for (let k = 0; k < 6; k += 1) {
      const btn = page.getByRole("button", { name: /^Cargar resultado / }).first();
      const label = (await btn.getAttribute("aria-label")).replace("Cargar resultado ", "");
      const [h, a] = label.split(" vs ");
      const s = score[`${h}-${a}`] || [...score[`${a}-${h}`]].reverse();
      await enterResult(page, `Cargar resultado ${label}`, s[0], s[1]);
      await expect(page.getByRole("button", { name: `Cargar resultado ${label}` })).toHaveCount(0);
    }

    // Correction by the organizer: change one league result, no double counting.
    await page.getByRole("button", { name: /^Corregir resultado .*Pumas.*Lobos|^Corregir resultado .*Lobos.*Pumas/ }).click();
    await page.getByLabel("Goles local").fill("2");
    await page.getByLabel("Goles visitante").fill("2");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/2\s*–\s*2/).first()).toBeVisible();

    // 8. Table: points, DG and the qualification line.
    await page.getByRole("button", { name: "Tabla" }).click();
    const rows = page.locator(".tn-table tbody tr");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText("Leones");
    await expect(rows.nth(0).locator(".tn-pts")).toHaveText("9");
    await expect(rows.nth(1)).toContainText("Tigres");
    const pj = await page.locator(".tn-table tbody tr td:nth-child(3)").allInnerTexts();
    expect(pj.map(Number)).toEqual([3, 3, 3, 3]);
    const stored = db.tournament_standings.map((r) => r.played).sort();
    expect(stored).toEqual([3, 3, 3, 3]);

    // 9. Knockouts: semifinals seeded 1º v 4º and 2º v 3º; a draw is not accepted.
    await page.getByRole("button", { name: "Calendario" }).click();
    await expect(page.getByText("Terminó la fase de liga")).toBeVisible();
    const sf1 = page.locator(".tn-round", { hasText: "Semifinales" }).locator(".tn-fixture").first();
    await expect(sf1).toContainText("Leones");
    await page.getByRole("button", { name: /^Cargar resultado Leones vs / }).click();
    await page.getByLabel("Goles local").fill("1");
    await page.getByLabel("Goles visitante").fill("1");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "tiene que haber un ganador" })).toBeVisible();
    await page.getByLabel("Goles local").fill("3");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("form", { name: "Cargar resultado" })).toHaveCount(0);
    await enterResult(page, /^Cargar resultado Tigres vs /, 2, 0);
    await expect(page.getByRole("button", { name: /^Cargar resultado Leones vs Tigres/ })).toBeVisible();
    // League results are locked once a knockout game is played.
    await expect(page.getByRole("button", { name: "Bloqueado" }).first()).toBeVisible();

    // 10. Final → champion → close.
    await enterResult(page, /^Cargar resultado Leones vs Tigres/, 1, 2);
    const banner = page.locator("[data-champion]");
    await expect(banner).toHaveAttribute("data-champion", "Tigres");
    await expect(banner).toContainText("Subcampeón: Leones");
    await page.getByRole("button", { name: "Declarar campeón y finalizar" }).click();
    await expect(page.getByText("Campeonato finalizado.")).toBeVisible();
    expect(db.tournaments[0].status).toBe("finished");
    await expect(page.getByRole("button", { name: /^Corregir resultado/ })).toHaveCount(0);

    // Share: WhatsApp text for champion, table and results.
    await page.getByRole("button", { name: "Compartir" }).click();
    await expect(page.locator("[data-share=champ] pre")).toContainText("¡Tigres es campeón de Copa QA!");
    await expect(page.locator("[data-share=table] pre")).toContainText("1. Leones — 9 pts");
    const wa = await page.locator("[data-share=table] a", { hasText: "WhatsApp" }).getAttribute("href");
    expect(wa).toMatch(/^https:\/\/wa\.me\/\?text=/);

    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });
}

test("solo playoffs with 8 teams: later rounds wait for winners", async ({ context, page }) => {
  await start(context, page);
  await page.getByRole("button", { name: /Nuevo campeonato/ }).first().click();
  await page.getByLabel("Nombre").fill("Relámpago");
  await page.locator("label.tn-format", { hasText: "Solo Playoffs" }).click();
  await page.getByLabel("Cantidad de equipos").selectOption("8");
  await page.getByLabel("Primer partido").fill("2026-12-05");
  await page.getByRole("button", { name: "Siguiente: equipos" }).click();
  await page.getByRole("button", { name: "Crear equipos y calendario" }).click();
  await expect(page.getByRole("heading", { name: "Cuartos de final" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Ganador Cuartos de final 1").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Tabla" })).toHaveCount(0);
  for (let i = 0; i < 7; i += 1) await enterResult(page, /^Cargar resultado /, 1, 0);
  await expect(page.locator("[data-champion]")).toHaveAttribute("data-champion", "Equipo A");
});

test("odd league (5 teams) shows who rests; a player sees it read-only", async ({ context, page }) => {
  const db = await start(context, page, { role: "player", seed: (d) => {
    const tid = "tour-1";
    d.tournaments = [{ id: tid, group_id: d.group.id, name: "Liga Impar", format: "league", status: "active", start_date: "2026-12-01", match_day: "tuesday", match_time: "19:00", venue: null }];
    d.tournament_teams = ["A", "B", "C", "D", "E"].map((x, i) => ({ id: `tt-${x}`, tournament_id: tid, name: `Equipo ${x}`, team_order: i + 1 }));
    d.tournament_matches = [
      { id: "tm-1", tournament_id: tid, round: 1, match_order: 1, home_team_id: "tt-A", away_team_id: "tt-E", match_date: "2026-12-01", status: "played", home_score: 2, away_score: 2 },
      { id: "tm-2", tournament_id: tid, round: 1, match_order: 2, home_team_id: "tt-B", away_team_id: "tt-D", match_date: "2026-12-01", status: "pending", home_score: null, away_score: null },
    ];
    d.tournament_standings = []; d.tournament_team_members = [];
  } });
  await expect(page.getByRole("button", { name: /Nuevo campeonato/ })).toHaveCount(0);
  await page.locator(".tn-list-item", { hasText: "Liga Impar" }).click();
  await expect(page.getByText("Descansa: Equipo C")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cargar resultado|Corregir/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Eliminar campeonato/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Tabla" }).click();
  await expect(page.locator(".tn-table tbody tr")).toHaveCount(5);
  expect(db.writes.filter((w) => w.table.startsWith("tournament"))).toHaveLength(0);
});

test("incomplete data: missing name/date and duplicate team names are explained", async ({ context, page }) => {
  await start(context, page);
  await page.getByRole("button", { name: /Nuevo campeonato/ }).first().click();
  await page.getByRole("button", { name: "Siguiente: equipos" }).click();
  await expect(page.getByRole("alert")).toHaveText("Poné el nombre del campeonato.");
  await page.getByLabel("Nombre").fill("Sin fecha");
  await page.getByRole("button", { name: "Siguiente: equipos" }).click();
  await expect(page.getByRole("alert")).toHaveText("Elegí la fecha del primer partido.");
  await page.getByLabel("Primer partido").fill("2026-12-01");
  await page.getByRole("button", { name: "Siguiente: equipos" }).click();
  await page.getByLabel("Nombre del equipo 2").fill("Equipo A");
  await page.getByRole("button", { name: "Crear equipos y calendario" }).click();
  await expect(page.getByRole("alert")).toHaveText("Hay dos equipos con el mismo nombre.");
});
