# F5 Manager — Friendly championships (branch `feat/f5-friendly-championships`)

Goal: a new organizer can create, run and close an informal championship from a phone, without help.
Scope kept small: existing tables, RLS and roles unchanged; no new services.

## Format matrix

| Format | Before (master `6c0f538`) | Now |
|---|---|---|
| **Liga** (3–12 teams, odd allowed) | Calendar OK; first matchday fell on the start date even if it wasn't the chosen weekday; results could not be corrected and a double save counted twice; no champion, never finished. | ✅ Weekly calendar on the right weekday, "Descansa: X" for odd counts, corrections recompute the table, champion = leader when every game is played (tie on the existing rule is reported, not guessed), close with "Declarar campeón y finalizar". |
| **Cuadrangular** (4 teams) | ❌ The final was fixed as team 1 vs team 2 by registration order before any game; any number of teams allowed (6 teams → 5 rounds); final counted in the table. | ✅ Exactly 4 teams; final filled with 1º vs 2º of the real table when the round robin ends; knockout games never change the table. |
| **Liga + Playoffs** (4–12) | ❌ Semifinals fixed by registration order (1v4, 2v3) at creation; with 3 teams a semifinal had an undefined team; the Final never got teams; semifinal results added points to the table. | ✅ Semifinals 1º–4º and 2º–3º seeded from the final table, Final from the semifinal winners, champion = Final winner. |
| **Solo Playoffs** (2, 4, 8) | ❌ Later rounds pre-filled with the *home* team of each previous game (assumed the home team wins); 3/5/6/7 teams produced half-empty games; no champion. | ✅ Only 2/4/8 teams; later rounds wait for real winners ("Ganador Cuartos de final 1"); champion = Final winner. |

All four formats were played to a champion in unit tests (4–8 teams), Playwright and on Staging.

## Defects fixed

1. Playoff/final slots were fixed at creation by registration order (cuadrangular, liga+playoffs) or by assuming the home team wins (solo playoffs) → now filled from the table / winners.
2. Liga+Playoffs Final never received teams; champion could never be determined.
3. Invalid team counts accepted per format (undefined teams, byes that could not be played).
4. Team count chosen in the form was lost (always 4 teams).
5. First matchday ignored the chosen weekday.
6. Results could not be corrected; repeated saves double counted standings (incremental updates). The table is now derived from the games and written back.
7. Knockout games changed the league table.
8. Empty score inputs saved 0–0; no validation of negatives/decimals.
9. No way to finish a championship or show the champion; no way to delete one.
10. Teams required ≥5 assigned players and could not be edited later; players are now optional and editable in «Equipos».
11. Standings showed only after a manual reload in some paths; now always computed from the games.

## Experience improvements

- One short create form: name, format (with allowed team counts), number of teams, first date ("Se juega los martes"), time, optional venue. The separate "Día de juego" field is gone (derived from the date).
- Teams and calendar in one step ("Crear equipos y calendario"); players optional with "Repartir parejo".
- "Próximo paso" hint for the organizer; empty states for organizers and players.
- Fixtures: "Cargar resultado" / "Corregir", explained locks ("Bloqueado"), placeholders that say where teams come from, resting team for odd leagues.
- Table: PJ G E P GF GC DG Pts, qualification line (top 2 / top 4) and a warning when it is tied.
- Champion banner (with runner-up) and a closed, read-only finished state.
- Players can follow every championship read-only (calendar, table, knockouts, teams, sharing). RLS already allowed members to read; only admins (admin or super admin, as RLS says) see management controls. **Product decision to confirm** — previously only the super admin could open Torneos.
- Sharing tab: WhatsApp text (champion, table, next round, last results) via `wa.me` links (no paid API) and a PNG image of the table or a round drawn on a canvas (shared with the native share sheet or downloaded).
- Editorial and Command Center keep distinct styles; checked in neon, midnight, gold and light.

## Rules kept and rules that need a decision

Kept as they were: 3/1/0 points; table order = points, then goals for (existing `listStandings` order); Liga+Playoffs semifinals 1–4 / 2–3; Solo Playoffs pairs in registration order.

Two rules were missing; nothing that changes results was invented:

1. **Tie-break** — current rule stops at goals for. When two teams are still level, the app keeps registration order and shows a warning on the qualification line; a league that ends level at the top shows "definan el campeón" instead of guessing.
   **Proposal (not applied):** points → goal difference → goals for → head-to-head → draw (sorteo). Switching is one comparator in `tournament/championship.js` (`compareStandings`).
2. **Knockout draws** — a knockout game must have a winner, so the app refuses a draw and asks for the deciding score (e.g. including penalties).
   **Proposal (not applied):** record penalties separately (needs two nullable columns, additive migration).

## Tests

- Vitest: 161/161 (31 new championship tests: round robin for 4–8 teams, rest days, full championships for every format, seeding, draws, validation, corrections and locks).
- Playwright (mock Supabase, desktop + Pixel 7): 10 new championship tests (organizer flow in both designs, 8-team knockout, odd league read-only for a player, incomplete data) + updated regression tests.
- Staging (local build, synthetic users/group, all removed): 23/23 — Liga+Playoffs 6 teams on a phone (draw, correction, refused knockout draw, champion, finish, image), Cuadrangular 4 (final = 1º v 2º), Solo Playoffs 8, odd Liga 5 by an admin with an all-draw tie, player read-only + RLS refusing player writes, delete; no JS/console/HTTP errors, no Production requests.

## Release notes

- No database migration: uses existing tables and the `is_playoff / is_final / playoff_label` columns already in Production.
- Production has 2 championships, both without games, so no stored results are affected by the new rules.
