# F5 Radar — MVP 1.0 build report (Staging)

- **Branch:** `feat/f5-radar-mvp`, on top of `docs/f5-radar-design`.
- **Plan:** `docs/F5_RADAR_MVP_PLAN.md`, built with the recommended decisions D1–D6. D7 and D8 remain open.
- **Status:** **released to Production on 2026-11-21 with Radar OFF for every group** (technical release; no pilot yet).
  - `master` @ `c9f4d3b`; Vercel Production `fut5-organizer-rgmrg5ebw` (f5manager.lat).
  - Rollback target: `fut5-organizer-orjfw4n6o` (`master` @ `4c31018`).

## What was built

| Area | Delivered |
| --- | --- |
| Database | `supabase/migrations/20261121180000_radar_mvp.sql` (additive and safe to re-run). It adds 6 tables, RLS that only allows `SELECT`, 18 client RPCs, internal helpers, three triggers that act only on Radar matches, and a membership guard for Radar players. |
| Group switch | **Grupos → Configuración → Radar** (super admin): "Permitir publicar partidos en Radar", "Mostrar el nombre del grupo" and the list of blocked players. |
| Publish | **Match detail → Radar** (admin): Private or Radar, Radar slots (no more than the free slots), level, positions, visible zone and note. Pause, reopen and back-to-private. It explains why a match cannot be published: Radar off, tags, past match, or a venue without a map location. |
| Discovery | **`/radar` → Partidos cerca**: list by zone or "near me" (location rounded to about 1 km on the device and never stored), date, level, slots, cost hint and distance bucket. Editorial shows cards; Command shows a dense list. |
| Request | Listing sheet with the rules: late-cancel fine of Q{group amount} within 4 h, pay on site, and what the organizer sees. Position plus a message of up to 280 characters. |
| Decide | **Match detail → Solicitudes**: Aceptar, Rechazar (with an optional note) and Bloquear. Accept is disabled when the Radar slots or the match are full. After an approval the app runs the existing `upsertMatchFee` split and reloads. |
| Player side | **`/radar` → Mis partidos y solicitudes**: statuses; once accepted, the address, fee, payment status and a roster of nicknames; withdraw; and "Cancelar mi cupo" with a late-cancel warning. |
| Notifications | A bell in the sidebar (desktop) and the top bar (mobile) that polls every 60 s and on focus. It links to the match inbox (admins) or "Mis partidos" (players). |
| Existing screens | Radar players appear as "Apodo · Radar" in the attendance list, teams, Cobros and Multas. Team generation includes them with the default rating. |
| Users without a group | Onboarding offers "Buscar partidos en Radar", and `/radar` works directly (link or reload) without a group. |
| Navigation | Desktop: a "Radar" entry in the sidebar. Mobile: a Radar button in the top bar, so the **bottom bar keeps its existing 5 entries**. |

## Defects found during validation (fixed)

| # | Defect | Evidence | Fix |
| --- | --- | --- | --- |
| 1 | **Existing code would make every Radar player a group member.** `loadData` "repairs" any attendee who is not a member by calling `api.joinGroup`. A Radar player then became an inactive member, `is_group_member()` ignores `is_active`, and so the player could read the group's matches, members and fees. | Staging browser QA: after approval, the outsider's next request failed with "Ya sos parte de este grupo". | Client: Radar players are excluded from that repair. Database (defense in depth, so older cached clients are also covered): trigger `radar_guard_membership` refuses to add a Radar player to a group unless the player makes the request themselves. Suite E16a and QA 4e verify it. |
| 2 | A user without a group who opened `/radar` directly was sent to `/grupos`. | Staging browser QA step 5. | `initializeWorkspace` keeps `/radar` when the user has no group. |
| 3 | A member re-confirming on a full Radar match would have been blocked: the upsert counted their own row twice. | Found in code review before applying. | Capacity excludes the row being written (`radar_occupancy(match, attendance, profile)`). Suite F4 verifies it. |
| 4 | Adding Radar as a 6th entry moved "Mi FIFA" into "Más" on mobile for every player. | Existing regression test (`security-and-regression.spec.js`). | Radar moved to the mobile top bar; the bottom bar is unchanged. |

## Validation

| Check | Result |
| --- | --- |
| Database suite on Staging (`frontend/scripts/qa-staging/radar-suite.cjs`) | **92/92**. Covers the RLS matrix on new and existing tables; publish, request, decide, cancel, ban and switch rules; notifications; privacy; and cleanup. |
| Concurrency | No overbooking or deadlocks in either race. Results show which writes won: 20 parallel approvals plus member confirmations for the last slots ended at **occupancy = max (6)**, with the members winning both slots. 8 parallel approvals of 4 requests produced **exactly 2 = Radar slots**, and the losers got clear errors. 10 parallel requests by one user created **1 row**. |
| Privacy | The `radar_nearby` key set is exactly the allow-list. No match or group ids, title, address, coordinates, phone or full name appear in outsider payloads. An approved outsider still reads **0 rows** of matches, attendances, payments and fines. |
| Private-match regression | Confirmations beyond `max_players` on a non-Radar match behave as before. The capacity trigger is inactive without a listing. |
| Vitest | **126/126**: 103 existing plus 23 Radar. Covers the model, API layer, page, admin panel, bell, settings and static migration checks. |
| Build | OK. Demo code (`src/dev/radarDemo.js`) is absent from `dist`. |
| Playwright | **93 passed, 1 skipped** (the skip is pre-existing). Includes `e2e/radar.spec.js` with 14 tests on desktop and mobile in both experiences, plus the player role. |
| Screenshots (`scripts/radar-shots.cjs`) | **132**: 2 experiences × 4 palettes × 3 viewports. **0** overflow, JS or console issues. |
| Staging browser QA (local build against Staging) | **25/25**: enable, publish, discover without a group, request, the admin's bell, approve, fee split 300/3 = Q100, nickname-only display, still not a member after reload, address and roster for the accepted player, late cancel creating a Q30 fine shown in Multas, rejection with a note, player view, and switching Radar off. 0 JS, console or HTTP errors, 0 Production requests, and cleanup verified. |

All accounts, groups and rows were synthetic and were removed after each run.

## Migration and safe deployment order (for a future authorization)

1. **Preview** (the protected Vercel Preview uses Staging, which already has the migration): repeat the Staging QA on the Preview URL.
2. **Production migration first:** apply `supabase/migrations/20261121180000_radar_mvp.sql`.
   - Use `supabase db query --linked -f …` plus `migration repair --status applied 20261121180000`, as was done for E4.
   - **Not** `db push`.
   - It only adds objects and every group starts with Radar **off**. It changes no existing policy.
   - It does add two triggers on existing tables (`attendances`, `guest_players`) that return immediately when the match has no listing, plus the `group_members` guard, which applies only to Radar players.
   - Check afterwards:
     - the policy fingerprint of the 90 existing policies is unchanged;
     - anonymous users have no execute rights on the `radar_*` functions;
     - zero-row RPC calls return 200.
3. **Frontend:** merge and deploy.
   - The frontend tolerates a missing migration: Radar calls fail softly and `radarGroupOutsiders` falls back to an empty list.
   - Even so, deploy it after the migration.
4. **Pilot:** a super admin enables Radar in one group (D8).
5. **Rollback:** turn Radar off per group (immediate), then redeploy the previous frontend. The tables can stay.

## Production release log (2026-11-21)

1. **Pre-checks (read-only):**
   - Only `20261121180000_radar_mvp` was pending; `db push --dry-run` listed nothing else.
   - All dependencies exist (helpers, columns, constraints), and nothing has a conflicting name.
   - Policy fingerprint before: `a639065f…`, 90 policies.
2. **Migration:**
   - The file is identical to `c9f4d3b` (md5 `794c3bf4…`).
   - Applied with `supabase db query --linked -f`, then `migration repair --status applied 20261121180000`. Only that version was recorded.
   - `db push --dry-run` now reports "Remote database is up to date". `--include-all` was not used.
3. **Verification:**
   - The 90 existing policies are unchanged (`a639065f…`).
   - The 6 new policies and 34 Radar functions are byte-identical to Staging (md5 `8a8f9764…` / `59f6ce83…`).
   - The new tables have RLS on: `authenticated` has `SELECT` only and `anon` has nothing.
   - 18 RPCs are executable by `authenticated`, 0 by `anon`.
   - Triggers: `radar_enforce_capacity`, `radar_enforce_capacity_guests`, `radar_after_match_change` and `radar_guard_membership` (each acts only on Radar matches or players).
4. **Radar OFF:**
   - 0 rows in `radar_group_settings` (all 7 groups disabled by default).
   - 0 listings, 0 requests, 0 access grants and 0 notifications.
   - None of the 89 upcoming matches is published.
   - Rechecked after the deploy with the same result.
5. **Frontend:**
   - Vitest 126/126, build OK and Playwright 93 passed (1 pre-existing skip) on exactly `c9f4d3b`.
   - Fast-forwarded `master` `4c31018 → c9f4d3b` with a normal push.
   - The deployment is Ready and f5manager.lat serves it.
6. **Bundle:** Production Supabase only. No Staging reference, no demo code, and no service keys, secrets or JWTs.
7. **Read-only smoke check, 32/32:**
   - public pages render without overflow on desktop and mobile;
   - `/partidos`, `/radar`, `/jugadores`, `/torneos`, `/grupos`, `/cobros` and `/reservas` require login and offer no demo;
   - invalid proof and reservation links show safe errors;
   - anonymous isolation holds, and every Radar table and RPC returns 401 to `anon`;
   - no JS, console or HTTP errors, no writes, Production only.
   - No test data was created in Production.

## Still open (not part of this build)

- **D7a — group waitlist** (C2): `joinWaitlist` writes a status and a column that Production rejects. Radar does not depend on it. It needs its own authorization.
- **D7b — guest link** (R1): the guest link accepts any match UUID. Radar never exposes match ids, but the guest link should get its own token.
- **D8 — pilot group.**
- **Signed-in Production validation for E2–E4:** still pending (see `docs/F5_RADAR_DESIGN.md` §2).
- **Known limits of the MVP:**
  - No push notifications (in-app only).
  - Outsiders pay on site (no proof upload).
  - No map view.
  - Radar players have no group rating (default 2 for teams).
