# F5 Manager — Premium close-out and F5 Radar design

- **Date:** 2026-11-21.
- **Production state:** E1–E4 are live on f5manager.lat. The last functional commit is `c9ecdf8`; `master` is at `4c31018`.
- **Scope of this document:** analysis and design only. The one exception is the authorized migration-history repair in section 1, which changed only history rows: no SQL, no RLS.

---

## 1. Migration reconciliation

Production's migration history is missing two repository migrations:

- `20260714152000_allow_players_to_manage_own_stats`
- `20260723200000_allow_admin_delete_attendances`

Every other migration file matches the history.

Evidence comes from read-only queries on `pg_policies`, `pg_class`, `pg_proc` and `supabase migration list`.

| Migration | What the SQL does | What Production has | Verdict |
| --- | --- | --- | --- |
| `20260714152000_allow_players_to_manage_own_stats` | Enables RLS on `match_player_stats`. Creates `"Permitir a jugadores gestionar sus propias estadísticas"`: `FOR ALL TO authenticated USING/WITH CHECK (auth.uid() = player_id AND is_group_member(group_id))`. | RLS is enabled (`relrowsecurity = true`). The policy `match_player_stats_manage_own` is `ALL`, `{authenticated}`, with USING and WITH CHECK both `(player_id = auth.uid()) AND is_group_member(group_id)`. Production also has `match_player_stats_select_member` and `match_player_stats_manage_admin`. The policy name from the file does not exist. | **Applied in effect, under another name.** The rule is identical. |
| `20260723200000_allow_admin_delete_attendances` | Creates `"attendances delete admin"`: `FOR DELETE TO authenticated USING (is_admin())`. `is_admin()` reads the **global** `profiles.is_admin` flag, so it applies to every group. | That policy name does not exist. Production has `attendances_delete_admin`, which allows `DELETE` only where `EXISTS (match m WHERE m.id = attendances.match_id AND is_group_admin(m.group_id))`. That is **scoped to the group** of the match. | **Superseded by a stricter rule.** The intent (admins can delete attendances) is covered. |

**Why they are missing:**
- Migration `20261119104500_harden_rls_multigroup_and_finance` (applied, recorded) drops **every** policy on 30 tables, including both of these, and recreates them with group-scoped names. That is section 3 of the file, a `DO $$ … DROP POLICY …` loop.
- So even if the two old files were applied by hand in July, their policies would have been removed on 2026-11-19. Today's state comes from the hardening migration.

**Risk if they were applied now:**
- `20260714152000` would only add a duplicate policy with the same rule. That is harmless, but it is noise.
- `20260723200000` would add a **global** delete policy. RLS policies are combined with OR, so any user with `profiles.is_admin = true` could delete attendances in **any** group. This undoes the multi-group isolation from 2026-11-19. **It must not be applied.**

**Done (2026-11-21, authorized):**
- I ran `supabase migration repair --linked --status applied 20260714152000 20260723200000`. No SQL was executed.
- `migration list` now shows both versions on the remote side, and `db push --dry-run` reports "Remote database is up to date".
- A fingerprint of all 90 public policies is identical before and after: md5 `a639065f…`, 90 policies.
- Both files now carry a "superseded — do not apply" header.

**Original recommendation:**
1. Mark both versions as applied in Production's history only, without running their SQL:
   ```bash
   supabase migration repair --linked --status applied 20260714152000 20260723200000
   ```
   This writes two rows to `supabase_migrations.schema_migrations`. It changes no policy, table or data.
2. In the same change, add a header comment to both files: "Superseded by 20261119104500 — do not apply manually". Then nobody re-runs them by hand.
3. Check afterwards:
   - `supabase migration list` shows both versions on the remote side;
   - `supabase db push --dry-run` reports "Remote database is up to date";
   - the policies on `attendances` and `match_player_stats` are unchanged.

Rejected alternatives:
- `db push --include-all` would execute the global delete policy.
- Deleting the files would rewrite repository history and break replays on new environments.
- Mark them `reverted` would make `db push` try to apply them again later.

---

## 2. Signed-in Production validation (E2–E4)

**Status: still pending.**
- There is no legitimately authorized Production session in this environment, and I did not create accounts, change roles, bypass login or ask for credentials.
- Done so far (read-only):
  - the E4 smoke check: 26/26 anonymous and public checks;
  - every Production schema check above;
  - zero-row API checks for the E4 queries.
- Still to check, signed in and read-only: Jugadores, Ranking and Mi FIFA; Cobros, cuotas, multas and tesorería; Reservas and Sedes; Torneos, standings and Grupos.
  - Check them in both experiences and with the four palettes, as admin and as player.
- How to close it:
  - **Manual walkthrough:** follow `docs/F5_VALIDACION_MANUAL_E2_E3.md`, adding Torneos, Grupos → Roles and Configuración, `/torneos` reload and the proof link.
  - **Assisted:** the owner signs in on the built-in browser, and the check runs read-only in that session.
- This does not block the Radar design work.

---

## 3. F5 Radar — architecture and MVP

### 3.1 Principles

1. **Radar is a layer over existing matches, not a new match system.**
   - A Radar listing always points to a `matches` row owned by a group.
   - Attendance, teams, payments, stats and ratings keep working exactly as now.
2. **Private by default.** Nothing is visible outside the group until a group admin opts a match in, and a player opts in to their availability.
3. **The group admin approves every external player.** Radar never adds someone to a match automatically.
4. **Never store or expose player positions.** Public coordinates come only from venues, which are public places. Player locations are coarse zones the player chose.
5. **Reputation comes only from verified events**: check-ins, no-shows, late cancellations and ratings from people who played the same match. There is no self-declared reputation.
6. **Existing RLS stays as it is.** Outsiders read Radar data only through narrow `SECURITY DEFINER` RPCs that return safe columns. New tables get their own policies.

### 3.2 What is reused

| Existing | Use in Radar |
| --- | --- |
| `profiles` (`nickname`, `avatar_url`, `preferred_position`) | Public Radar identity: nickname and avatar only. Never `phone`, `full_name` or `group_tags`. |
| `groups`, `group_members` (`role`, `is_active`), `is_group_admin()` | Who can publish a match and approve requests: the admins of the match's group. |
| `matches` (`match_date`, `start_time`, `min/max_players`, `status`, `venue_id`) | The listing's facts. Open slots are `max_players` minus confirmed attendances. |
| `attendances` | Approved external players join the match through a normal attendance row. |
| `venues` (`lat`, `lng`, `address`) | The only geographic source for discovery. |
| `guest_players` and the guest token flow (`getPublicMatchForGuest`, `registerGuest`) | **Invite** visibility reuses this link-based flow for people without an account. |
| `player_ratings`, `player_votes`, `match_player_stats` | Passport inputs, read through aggregates only. |
| `push_subscriptions`, VAPID | Notifications for requests, approvals and Rescue. |
| `llm_rate_limits` pattern | Template for per-user rate limits on requests and Rescue. |

Schema facts that shape the design:
- `attendances.status` allows `confirmed`, `canceled`, `checked_in` and `no_show`. There is no `waitlist`, although an RLS policy mentions it.
- Radar requests therefore live in their own table, and only approved requests become attendances.
- `postgis`, `earthdistance` and `pg_cron` are available but not installed.

### 3.3 Data model (additive, for a future authorized migration)

```
match_visibility   match_id PK → matches, mode text check ('private','invite','radar') default 'private',
                   open_slots int, level_min int, level_max int, positions text[], note text(≤200),
                   radar_until timestamptz, updated_by, updated_at
radar_requests     id, match_id → matches, requester_id → profiles, message text(≤280),
                   status ('pending','approved','rejected','withdrawn','expired'),
                   decided_by, decided_at, created_at, unique(match_id, requester_id)
match_access       match_id, profile_id, source ('radar','rescue'), granted_by, expires_at
                   — match-scoped read grant for approved outsiders (they are not group members)
player_availability id, profile_id, zone_cell text (coarse geohash, precision 5 ≈ 5 km), radius_km (≤ 15),
                   days smallint[], time_from, time_to, level_self int null, positions text[],
                   visible_until timestamptz (max 30 days), is_active
radar_rescues      id, match_id, requested_by, needed int, radius_km, status ('open','filled','closed'),
                   notified_count, created_at, closes_at
match_reports      id, match_id, reporter_id, subject_id, kind ('no_show','late','fair_play_issue','great_teammate'),
                   created_at — only between people who both have checked_in on that match
radar_blocks       blocker_id, blocked_id — hides each other in Radar
```

Notes:
- Keeping visibility in `match_visibility` instead of new columns on `matches` leaves `matches` and its RLS unchanged.
- Groups enable Radar per group with a new `settings` key, for example `radar_enabled`, which is off by default.

### 3.4 Access layer (RPCs, `SECURITY DEFINER`, `search_path = public`)

| RPC | Who | Returns or does |
| --- | --- | --- |
| `radar_nearby(lat, lng, radius_km, date_from, date_to)` | authenticated | Lists `mode='radar'` matches that are open, upcoming, within `radar_until`, in a Radar-enabled group and not blocked. It returns only: match id, date, time, venue name and neighborhood, **distance bucket** (<2, 2–5, 5–10, 10–15 km), open slots, level band, positions and group display name. The input point is rounded to about 1 km before the query, and the radius is capped at 15 km. |
| `radar_request(match_id, message)` | authenticated | Inserts a `pending` request after checking slots, blocks, duplicates and the rate limit (for example 10 per day). It notifies the group admins. |
| `radar_decide(request_id, approve)` | `is_group_admin(match.group_id)` | Approval writes `match_access` plus a `confirmed` attendance in one transaction and re-checks capacity. Rejection only changes the status. The requester is notified either way. |
| `radar_set_visibility(match_id, mode, …)` | group admin | Upserts `match_visibility`. `invite` reuses the guest token link; `radar` requires the group's `radar_enabled`. |
| `availability_upsert(…)` / `availability_off()` | the player themself | Stores only a coarse `zone_cell`, never GPS. |
| `radar_rescue_start(match_id, needed)` | group admin | Matches active availabilities by zone, day, time and level, excluding blocked users and existing members. It sends a push with no location detail and records the count. Limit: one Rescue per match every 30 minutes. Recipients answer with a normal `radar_request`. |
| `passport_get(profile_id)` | authenticated | Returns only aggregates (next section). Detailed history stays private. |

New table RLS:
- requesters read their own requests, and the match's group admins read requests for their matches;
- players manage their own availability;
- **no direct `SELECT` for anyone else**: discovery goes only through `radar_nearby`.

Existing policies that need one deliberate, reviewed change at implementation time:
- An approved outsider must be able to read the one match they joined and its attendance list.
- Proposed change: extend the select helpers with `OR has_match_access(match_id)`, applied only to `matches` and `attendances`.
- Their payments, fines and stats stay group-only.

### 3.5 F5 Passport (verifiable reputation)

| Signal | Source | Shown as |
| --- | --- | --- |
| Matches played | `attendances.status='checked_in'`, all groups | Count, plus number of groups (no group names) |
| Reliability | `no_show` and late `canceled` versus confirmed, last 90 days | Band: Excellent, Good, Irregular. Shown after 5 or more matches; before that, "New" |
| Peer feedback | `match_reports` between co-attendees, and existing `player_votes` | Counts of positive tags; negative tags affect only the reliability band |
| Level | Average of `player_ratings` across groups | Level band (1–5), not the exact number |
| Verification | Account age and confirmed email | Badge |

Rules:
- Every number comes from rows produced by real matches.
- A player can see why their band changed.
- There are no public comments.

### 3.6 Location privacy and safety

- **Discovery** uses venue coordinates only.
  - The browser's geolocation is asked only when the user taps "Cerca de mí". It is rounded on the device before sending and is never stored.
  - The alternative is choosing a zone or a known venue.
- **Distances** are shown in buckets, never as exact values. Venue addresses are shown only after approval; before approval only the neighborhood.
- **Availability** is stored as a coarse cell, around 5 km, and expires automatically after at most 30 days.
- **Identity:** outsiders see only nickname, avatar, Passport bands and preferred positions.
  - Phone and full name are never exposed.
  - Contact happens inside the app, through the request message.
- **Abuse controls:**
  - rate limits on requests, Rescue and availability changes;
  - mutual block;
  - admins can reject requests and revoke access;
  - "report" through `match_reports`;
  - Radar is off by default for every group.
- **Data retention:**
  - requests older than 90 days are archived;
  - expired availabilities are deleted;
  - `match_access` expires 24 hours after the match.

### 3.7 MVP and phases

| Phase | Scope | Why this order |
| --- | --- | --- |
| **MVP (Radar 1)** | Per-group `radar_enabled`. Match visibility (`private` / `invite` / `radar`). `radar_nearby` as a list with date and distance filters (no map yet). Request → admin approval → attendance and `match_access`. Push and in-app notices. Mutual block. Nickname-only identity. | Delivers the core loop (find → ask → approve → play) on top of existing matches, with the fewest RLS touch points. |
| **Radar 2** | Player availability, and Radar Rescue (targeted push to matching availabilities). | Needs availability data and solid rate limits, and builds on the MVP's request flow. |
| **Radar 3** | F5 Passport (bands and verified badges), post-match reports, and a map view. | Reputation is meaningful only after several weeks of Radar matches with check-ins. |

Frontend:
- a `/radar` page with "Partidos cerca" and "Mis solicitudes";
- a visibility control and a requests inbox in Match Detail, for admins;
- an availability toggle in Profile (Radar 2).
- It uses the premium components in both experiences and all four palettes.

Rollout plan:
1. Additive migration on Staging, and RPC tests with synthetic users in three groups.
2. Add RLS checks to the Staging QA. A non-member must not read anything outside `radar_nearby`, and an approved outsider can read only their own match.
3. Preview with Radar enabled for one test group.
4. Production migration with authorization.
5. Enable Radar for one pilot group.

### 3.8 Decisions needed before implementation

1. **Payments for outsiders:** do approved outsiders pay through the existing match-fee flow (needs `match_access` in the payment policies), or settle on site in the MVP? The recommendation is on site for the MVP.
2. **Level source:** should only admin `player_ratings` count, or should self-declared level be allowed for new players, shown separately?
3. **Geography:** start with plain SQL distance on venue coordinates and no extension, or install `postgis` now? The recommendation is no extension for the MVP.
4. **Minimum age and terms:** Radar shows people to strangers, so it needs an acceptance step and an age confirmation.
5. **Pilot group** and **success metric**: filled spots per week and the percentage of matches rescued.
