# F5 Premium — Entrega 4: Torneos, Grupos/Administración y páginas públicas

- **Branch:** `feat/f5-premium-tournaments-admin` (from `master` @ `e158568`).
- **Status:** released to Production on 2026-11-21 (`master` @ `c9ecdf8`, f5manager.lat).
- **Production database:** only the migration `20261121120000_tournament_playoff_columns.sql` was applied, with authorization. Nothing else changed.

## What is delivered

| Area | Change |
| --- | --- |
| Torneos | List, calendar by round, standings (DG and recent form), playoff bracket, teams, team setup steps and creation form, in Editorial and Command. The four palettes apply. |
| Grupos | My groups, group description, invitation, and a read-only "Roles y permisos" matrix (`src/admin/permissions.js`). |
| Configuración | The fine settings from the former Super Admin page are reachable again under **Grupos → Configuración**, for super admins only (same condition as before: `isSuperAdmin`). |
| Public pages | `/reserve/<token>`, `/proof/<token>` and group onboarding share one premium identity, independent of the internal designs, with AA contrast and the device's light/dark scheme. |

## Defects fixed (with evidence)

| # | Defect | Cause | Fix |
| --- | --- | --- | --- |
| 1 | "Generar calendario" failed for Cuadrangular, Liga + Playoffs and Solo Playoffs (staging and Production). | `tournament_matches` had no `is_playoff`, `playoff_label` or `is_final`. The engine writes them. | Additive migration `supabase/migrations/20261121120000_tournament_playoff_columns.sql`. |
| 2 | After the migration, inserts failed with `23502 null value in column "is_final"`. | In a bulk insert PostgREST receives the union of keys, so rows without the key sent `NULL`. | `createTournamentMatches` uses `insert(rows, { defaultToNull: false })`. Missing keys now take `DEFAULT false`. |
| 3 | Tournament detail returned 400 on staging. | `PGRST200` "Could not find a relationship between 'tournament_matches' and 'tournament_teams'" (and the same for standings). Staging had drifted: its foreign keys and checks were missing. Production has them, and the same queries return 200 there. | `supabase/staging/20261121_align_tournament_constraints_staging.sql` (staging only). App code unchanged. |
| 4 | Match-fee proof link showed "Pago no encontrado" (**Production too**). | `PGRST200` "Could not find a relationship between 'match_fee_payments' and 'matches'". The query embedded `matches!inner(title)` directly. | Nested embed `match_fees!inner(..., matches(title))`. Verified valid on staging and Production with `limit=0`. |
| 5 | `/torneos` (direct link or reload) redirected a super admin to `/partidos`. | The page guard ran before the groups and role finished loading. | `rolesResolved` flag plus `src/routing/roleGate.js`. Shows "Verificando tus permisos…" while loading, and redirects only once the role is known. |
| 6 | Fine settings were unreachable. | `SuperAdminPage` was unlinked in `f59361b`. | Same panel, same handler and payload, `isSuperAdmin` only. RLS unchanged. |

## Migration and safe deployment order

1. **Apply the migration to Production first** (needs authorization):
   - File: `supabase/migrations/20261121120000_tournament_playoff_columns.sql`.
   - It is additive and idempotent: three `ADD COLUMN IF NOT EXISTS` plus `NOTIFY pgrst, 'reload schema'`.
   - Existing rows get `false` / `NULL`.
   - No table, data, policy or relation is dropped or changed, and RLS is inherited.
   - Check afterwards:
     - `select is_playoff, is_final, playoff_label from tournament_matches limit 0` returns 200;
     - `information_schema.columns` lists the three columns.
2. **Deploy the frontend** (Preview, then Production). The frontend is also safe before the migration:
   - Liga does not send the new keys.
   - The other formats already failed before this change.
   - The proof-link fix (#4) and the `/torneos` fix (#5) do not depend on the migration.
3. **Rollback:**
   - Frontend: redeploy the previous Production version (`master` @ `e158568`).
   - Database: the columns can stay, because they are harmless. If removal is ever required: `ALTER TABLE public.tournament_matches DROP COLUMN IF EXISTS ...`.
4. **Do not run** `supabase/staging/*.sql` on Production. Production already has those constraints.

> The repository folder is linked to the **Production** project in the Supabase CLI. Never run `supabase db push` from it without explicit authorization. Staging was managed from a separate folder linked to `ylynjvssjlmhzgmhkrsd`.

## Validation

### Local

| Check | Result |
| --- | --- |
| Vitest | 103/103 |
| Build | OK, no demo code in `dist` |
| Playwright | 79 passed, 1 intentionally skipped |
| Screenshots | 210 for E4 with 0 overflow issues (`scripts/e4-shots.cjs`), plus an E3 recheck with a stricter mobile check (180, 0 issues) |

### Chamusca-Staging (local build, 31/31)

- **Four formats:** each went through real "Generar calendario" from the UI. The stored rows equal `generateFixtures`, and the rounds, Llaves tab, result entry and standings equal `updateStandings`.
  - Teams were seeded because staging has only 2 synthetic players and setup requires at least 5 per team.
- **`/torneos`:** direct link and reload keep the page for a super admin; a player is redirected only after the role is known.
- **Fine settings:**
  - the super admin saves through the UI;
  - an admin and a player do not see the tab;
  - a player's direct API update affects 0 rows (RLS).
- **`/proof`:**
  - the owner uploads, and the status becomes `submitted`;
  - someone else's proof is refused, with no file input;
  - an anonymous visitor is asked to sign in;
  - an invalid token shows an error.
- **`/reserve`:**
  - an anonymous visitor can view the link;
  - the assigned player (signed in) uploads, and `proof_url` is saved;
  - an invalid link shows an error.
- **Onboarding:** renders and searches.
- **Cleanup:** all synthetic rows and Storage objects were removed, roles were restored, and there were 0 production requests.

## Release log (2026-11-21)

1. **Preview** `fut5-organizer-8jsx8atnh` (protected, uses Staging): E4 QA 31/31 with no Production requests.
2. **Production migration:**
   - Applied with `supabase db query --linked -f supabase/migrations/20261121120000_tournament_playoff_columns.sql`.
   - Recorded with `supabase migration repair --status applied 20261121120000`.
   - Verified: `information_schema` lists `is_playoff` (boolean, not null, default false), `is_final` (same) and `playoff_label` (text, nullable). `limit=0` GETs return 200 for the new columns, the team embed and the proof-link query.
   - `supabase db push` was **not** used. Its dry run wanted to include two older local migrations that are missing from Production's history (see risks).
3. **Frontend:**
   - `master` fast-forwarded `e158568 → c9ecdf8` and pushed.
   - Vercel Production deployment `fut5-organizer-9bcd2lyvz` is Ready, and f5manager.lat serves the E4 bundle.
4. **Production smoke check (read-only, 26/26):**
   - landing, FAQ and login render without overflow, on desktop and mobile;
   - `/partidos`, `/torneos`, `/grupos`, `/cobros` and `/reservas` require login and offer no demo;
   - invalid `/proof` and `/reserve` links show the premium error or login state, with no file input;
   - anonymous isolation holds;
   - no JS, console or HTTP errors, no writes, and Supabase Production only.

## Known risks / pending decisions

- **Migration history drift in Production:**
  - `20260714152000_allow_players_to_manage_own_stats.sql` and `20260723200000_allow_admin_delete_attendances.sql` exist in the repo but are not recorded in Production's migration history.
  - Their policies may or may not be in place in Production. This was not changed or investigated (outside E4).
  - Until it is reconciled, do not run `supabase db push --include-all`.

- **Anonymous reservation-proof upload is denied (Production too).** The Storage policy `reservation_proofs_insert_valid_reservation` checks `court_reservations` with a subquery, and `anon` cannot read that table under RLS. Signed-in group members can upload.
  - Fixing it needs a security decision, for example a `SECURITY DEFINER` helper in the policy. Not changed here.
- **Existing engine rules, not changed:**
  - Playoff pairings are fixed when the calendar is generated (by team order, not by standings).
  - `playoffs_only` pre-assigns later rounds.
  - Winners are not propagated automatically.
  - Recording a playoff result also updates the standings.
- **Staging drift that remains (does not affect E4):**
  - `public.submit_payment_proof` is missing in staging; the app falls back to a direct update.
  - The `collections.created_by` foreign key is missing in staging.
- **Logged-in E2/E3 check in Production:** still pending; see `docs/F5_VALIDACION_MANUAL_E2_E3.md`.
