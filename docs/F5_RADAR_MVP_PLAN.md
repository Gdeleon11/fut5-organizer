# F5 Radar — MVP 1.0 implementation plan

- **Base:** `docs/F5_RADAR_DESIGN.md` (section 3).
- **Branch:** `docs/f5-radar-design`.
- **Status:** plan only, for authorization. Nothing was built, migrated or deployed.
- **Production:** read only (`pg_policies`, `pg_proc`, `pg_constraint`, `information_schema`).
- **Scope:**
  - **In:** publish one match to Radar, discovery by approximate zone, requesting a spot, admin approval, joining the match without group membership, slots, cancellations and settlements, in-app notifications.
  - **Out:** Passport and reputation, automatic Rescue, feed, messaging, challenges between groups, monetization, player availability, map view, push notifications.

---

## 0. Compatibility check against the current schema

The design document was checked against Production and the current code. Six findings change the plan.

| # | Finding (evidence) | Effect on the MVP |
| --- | --- | --- |
| C1 | **The guest link token is the match UUID.** `get_public_match_for_guest` and `register_guest_for_match` take `parse_uuid_token(p_token)` and accept **any** upcoming match id, with no visibility flag. | Radar must **never expose `matches.id`** to outsiders. Otherwise anyone could skip approval through `/guest/<id>`. Radar gets its own public handle, `radar_listings.id` (a random UUID), and every outsider RPC takes that handle. Hardening the guest link is a separate decision (§7, R1). |
| C2 | **The group waitlist does not work in Production today.** `api.joinWaitlist` writes `status: "waitlist"`, but `attendances_status_check` only allows `confirmed / canceled / checked_in / no_show`. It also sends `group_id`, a column `attendances` does not have. | Radar does not depend on the group waitlist: pending requests are Radar's own queue. Requirement 6 ("respect waitlists") needs a **separate, prior fix** (stage 0) to add `waitlist` to the check and drop `group_id` from the payload. That changes an existing Production constraint and needs its own authorization. It was diagnosed from the schema only; reproduce it on Staging before fixing. |
| C3 | **Capacity is enforced only in the browser.** `isFullMatch` counts confirmed attendances only, not guests. The server-side guest RPC counts attendances plus `guest_players`. Nothing locks the match row, and `confirmAttendance` is a plain upsert. | Overbooking is possible today under concurrency. For **Radar matches only**, a trigger takes a lock on the match row and enforces `occupancy ≤ max_players` for every write path. Private matches keep today's behavior (§2.4). |
| C4 | **Outsiders are invisible to group RLS.** `profiles_select_own_or_shared_group` uses `shares_group_with`, and matches, attendances, fees and fines use `is_group_member`. RLS works on rows, not columns, so widening `profiles` would expose `phone` and `full_name`. | **No existing policy is changed.** Outsiders read only through Radar RPCs. Admins see Radar players' nickname, avatar and position through `radar_match_people`. Screens that join `profiles` (attendance list, Cobros, Multas, Equipos) need a fallback label, "Jugador Radar · apodo". |
| C5 | **A user with no group cannot get past onboarding.** `App.jsx:2096` renders `GroupOnboardingPage` whenever `memberships.length === 0`. | `/radar` must be reachable from that state: an onboarding entry point plus a route allowed before group selection. |
| C6 | **Settlement rules live in the client.** `upsertMatchFee` re-splits `court_cost` across confirmed players. A cancellation within 4 hours (`App.jsx:1073`) creates a `late_cancel` fine for `settings.late_cancel_fine_amount`. Fine and payment inserts by non-admins require group membership. | After approving, the **admin's** session runs the existing `upsertMatchFee`, so the split rule stays identical. An outsider's late cancellation is applied inside a `SECURITY DEFINER` RPC with the same 4-hour rule and the group's amount. Outsiders pay on site in the MVP; there is no proof upload for them. |

Other facts used:
- `matches.status` is `upcoming / closed / canceled`.
- `matches.allowed_tags` limits a match to tagged members.
- `venues` has `lat` and `lng`.
- `settings` has **no unique key on `group_id`**, so Radar's group switch gets its own table.
- No geography extension is installed; plain SQL is enough for the MVP.

---

## 1. Data model (one additive migration)

The migration file would be `supabase/migrations/2026MMDDhhmmss_radar_mvp.sql`. It is applied to Staging first and to Production only with authorization.
- It does not alter or drop any existing column, table or policy.
- It adds new tables, two narrow triggers and RPCs.

```sql
-- Group switch (off by default; super_admin decides)
create table public.radar_group_settings (
  group_id        uuid primary key references public.groups(id) on delete cascade,
  enabled         boolean not null default false,
  show_group_name boolean not null default false,   -- otherwise "Grupo privado"
  updated_by      uuid references public.profiles(id),
  updated_at      timestamptz not null default now()
);

-- One listing per published match. Its id is the public handle (never matches.id).
create table public.radar_listings (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null unique references public.matches(id) on delete cascade,
  group_id     uuid not null references public.groups(id) on delete cascade,
  status       text not null default 'open' check (status in ('open','paused','closed')),
  radar_slots  int  not null check (radar_slots between 1 and 22),   -- max outsiders to accept
  level_band   text not null default 'any' check (level_band in ('any','casual','intermedio','competitivo')),
  positions    text[] not null default '{}',          -- subset of the app's positions
  note         text check (char_length(note) <= 200),
  zone_label   text not null check (char_length(zone_label) between 2 and 60),  -- neighborhood shown before approval
  close_at     timestamptz,                            -- default: match start minus 2 h
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.radar_requests (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.radar_listings(id) on delete cascade,
  match_id      uuid not null references public.matches(id) on delete cascade,
  group_id      uuid not null references public.groups(id) on delete cascade,
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  position      text,
  message       text check (char_length(message) <= 280),
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','withdrawn','canceled','expired')),
  decided_by    uuid references public.profiles(id),
  decided_at    timestamptz,
  decision_note text check (char_length(decision_note) <= 200),
  attendance_id uuid references public.attendances(id) on delete set null,
  late_cancel   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- one live request per person per match; a rejection also blocks re-requesting that match
create unique index radar_requests_one_live
  on public.radar_requests (match_id, requester_id)
  where status in ('pending','approved','rejected');
create index radar_requests_requester on public.radar_requests (requester_id, created_at desc);
create index radar_requests_match_pending on public.radar_requests (match_id) where status = 'pending';

-- Match-scoped grant for approved outsiders (used by RPCs; no existing policy reads it)
create table public.radar_match_access (
  match_id   uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null references public.radar_requests(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (match_id, profile_id)
);

-- Group-level ban (admin stops someone from requesting this group's matches)
create table public.radar_group_bans (
  group_id   uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

-- In-app notifications (generic table, MVP only writes radar kinds)
create table public.app_notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in (
                 'radar_request_received','radar_request_approved','radar_request_rejected',
                 'radar_request_expired','radar_spot_canceled','radar_match_changed','radar_match_canceled')),
  listing_id   uuid references public.radar_listings(id) on delete set null,
  request_id   uuid references public.radar_requests(id) on delete set null,
  title        text not null check (char_length(title) <= 120),
  body         text check (char_length(body) <= 280),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index app_notifications_inbox on public.app_notifications (recipient_id, created_at desc);
create index app_notifications_unread on public.app_notifications (recipient_id) where read_at is null;
```

Not in the MVP:
- `player_availability`, `radar_rescues`, `match_reports` and Passport.
- Private versus Radar is simply whether an `open` listing exists. Every existing match stays private, because no listing rows exist.

---

## 2. Security

### 2.1 RLS on the new tables

| Table | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| `radar_group_settings` | `is_group_member(group_id)` | none directly; written only through `radar_set_group_settings` (super_admin) |
| `radar_listings` | `is_group_member(group_id)`. Outsiders get **no** direct select; they use `radar_nearby` and `radar_listing_card`. | none directly; written only through RPCs (admin) |
| `radar_requests` | `requester_id = auth.uid()` OR `is_group_admin(group_id)` | none directly; written only through RPCs |
| `radar_match_access` | `profile_id = auth.uid()` OR `is_group_admin(match's group)` | none; written only through RPCs |
| `radar_group_bans` | `is_group_admin(group_id)` | none directly; written only through RPCs |
| `app_notifications` | `recipient_id = auth.uid()` | UPDATE of `read_at` only, own rows (column grant plus policy). No INSERT or DELETE: notifications are written only by `SECURITY DEFINER` functions. |

- Every new table has `ENABLE ROW LEVEL SECURITY`.
- `REVOKE ALL` from `anon`. Radar requires a signed-in user, so nothing goes to `anon`.
- Writes happen only through RPCs, so validation and locking cannot be bypassed from the client.

### 2.2 Existing policies

**No change.** Outsiders get no rows from `matches`, `attendances`, `profiles`, `match_fees`, `match_fee_payments`, `fines`, `venues`, `groups` or `group_members`. Everything they need comes from the RPCs below, which return fixed safe columns.

### 2.3 RPCs

All are `SECURITY DEFINER`, `SET search_path = public`, executable by `authenticated` only, and raise errors in Spanish.

| RPC | Caller check | Behavior |
| --- | --- | --- |
| `radar_set_group_settings(group, enabled, show_group_name)` | `is_group_super_admin(group)` | Upsert. Disabling closes every open listing of the group, which expires its pending requests and sends notifications. |
| `radar_publish_match(match_id, radar_slots, level_band, positions, note, zone_label, close_at)` | `is_group_admin(match.group_id)` | Requires: Radar enabled for the group; match `upcoming` and in the future; `allowed_tags` empty; a venue with `lat`/`lng`; `radar_slots ≤ max_players − occupancy`; `close_at ≤ start`. Upserts the listing as `open` and returns `listing.id`. |
| `radar_update_listing(listing_id, …)` / `radar_close_listing(listing_id)` | admin | Pause, reopen or close. Closing expires pending requests and notifies requesters. Approved players stay in the match. |
| `radar_nearby(p_lat, p_lng, p_radius_km, p_from, p_to, p_level)` | authenticated | Rounds the input to 2 decimals (about 1 km). Caps the radius at 15 km and the window at 14 days. Returns open listings whose `close_at` has not passed, excluding matches of groups the caller belongs to, groups that banned the caller, and full listings. See the columns below. |
| `radar_listing_card(listing_id)` | authenticated | The same safe columns for one listing, plus the caller's request status. The address, roster and fee are shown only if the caller is approved. |
| `radar_request_spot(listing_id, position, message)` | authenticated | The caller must not be a member of the group (members use the group flow), must not be banned, must have a nickname, and the listing must be open with free Radar slots. Rate limits: 10 requests per 24 h and 3 pending at once. Inserts `pending` (the unique index prevents duplicates) and notifies the group's active admins. |
| `radar_withdraw_request(request_id)` | requester | `pending → withdrawn`. If the request is approved, it delegates to `radar_cancel_spot`. |
| `radar_decide_request(request_id, approve, note)` | `is_group_admin(group)` | Locks the match row with `FOR UPDATE`, then rechecks: request still `pending`, listing open, match upcoming, `approved_count < radar_slots` and `occupancy < max_players`. **Approve:** upsert the attendance `(match_id, profile_id) → confirmed`, reusing the existing unique key; insert `radar_match_access`; mark the request `approved` with `attendance_id`; notify. **Reject:** set `rejected` plus a note, and notify. Returns the new state so the admin UI can run `upsertMatchFee`. |
| `radar_cancel_spot(request_id)` | requester (approved) | Locks the match. Sets the attendance to `canceled` and revokes access. If fewer than 4 hours remain before the match (computed in the timezone from §7, D5), inserts a `late_cancel` fine for `settings.late_cancel_fine_amount` (default 25, the same as the app). Marks the request `canceled` with `late_cancel` and notifies the admins. The Radar slot reopens automatically. |
| `radar_ban(group, profile_id)` / `radar_unban` | admin | Bans also reject that person's pending requests. |
| `radar_my_requests()` | authenticated | The caller's requests, with safe match info. Approved requests add the address, per-player fee, payment status (`match_fee_payments` row for the caller) and the caller's own fine, if any. |
| `radar_match_people(match_ref)` | a member of the match's group, or a holder of active `radar_match_access` | Confirmed and checked-in attendees with `nickname`, `avatar_url`, `preferred_position` and an `is_radar` flag. **Never** `phone` or `full_name`. |
| `notifications_mark_read(ids[])` | own | Sets `read_at`. |

**Columns `radar_nearby` returns** (allow-list; tests check the exact key set):
- `listing_id`, `match_date`, `start_time`;
- `venue_name`, `zone_label`, `distance_bucket` (`<2`, `2–5`, `5–10`, `10–15` km);
- `max_players`, `occupancy`, `radar_slots_left`;
- `level_band`, `positions`, `note`;
- `cost_hint` (`ceil(court_cost / max_players)` when `court_cost > 0`);
- `organizer_label` (the group name only if `show_group_name`, otherwise "Grupo privado").

It never returns `match_id`, `group_id`, the venue address or coordinates, member names, or the match title. Titles are free text and may contain names.

### 2.4 Capacity and concurrency

- Every Radar write locks the match row first: `select … from matches where id = $1 for update`. That serializes approvals, cancellations and confirmations for the same match.
- New trigger `radar_enforce_capacity`, `BEFORE INSERT OR UPDATE OF status ON attendances`:
  - It acts **only if** the match has a `radar_listings` row and the new status is `confirmed` or `checked_in`.
  - It locks the match row and computes `occupancy = attendances(confirmed, checked_in, excluding NEW.id) + guest_players`, matching the server's existing guest count.
  - If occupancy is already `max_players` or more, it raises `'El partido ya alcanzó el cupo máximo.'`.
- New trigger `radar_enforce_capacity_guests`, `BEFORE INSERT ON guest_players`, does the same for Radar matches.
- Private matches never have a listing, so the triggers return immediately. **Today's behavior for every existing match is unchanged.**
- Duplicates are prevented by:
  - `attendances (match_id, profile_id)` UNIQUE, which already exists;
  - the partial unique index on `radar_requests`;
  - the `match_id` UNIQUE on `radar_listings`.
- Match change notifications: trigger `radar_notify_match_change`, `AFTER UPDATE OF status, match_date, start_time, venue_id ON matches`.
  - It does work only when a listing exists.
  - Cancel: closes the listing, notifies approved and pending players, and expires pending requests.
  - Date, time or venue change: notifies approved players.
  - It never blocks the update.

### 2.5 Privacy

- There are no personal locations.
- "Cerca de mí" uses `navigator.geolocation` only when the user taps it. The point is rounded on the device before being sent and is never stored, logged or put in the URL.
- The alternative is a zone picker built from the `zone_label` values of open listings.
- Before approval, outsiders see the zone, venue name and a distance bucket. After approval they also see the address.
- Outsiders never become `group_members`, so they never see the group's other matches, members, finances or chats.
- Admins see a requester's nickname, avatar, preferred position and message only.

---

## 3. User flows and screens

All new screens use the premium components in both experiences (Matchday Editorial and Sports Command Center) and all four palettes, following the E1–E4 conventions.
- Pages use the `.pl-tabs` tab bar and `md-form` form styles.
- Loading, empty and error states are reused.
- Mobile layouts must fit 375 px without horizontal scroll.
- Everything is accessible by keyboard, with labeled inputs.

| # | Flow | Screens |
| --- | --- | --- |
| F1 | **Enable Radar** (super_admin) | **Grupos → Configuración:** a new "Radar" card with "Permitir publicar partidos en Radar" and "Mostrar el nombre del grupo". |
| F2 | **Publish a match** (admin) | **Match Detail → "Radar" panel:** "Privado / En Radar" switch, Radar slots (≤ free slots), level, needed positions, note, zone label (defaults to the venue name), and closing time. It shows why publishing is disabled: tags, no coordinates, past match, Radar off. The match card in Partidos shows a Radar badge and a pending-request count. |
| F3 | **Discover** (any signed-in user) | **`/radar` → "Partidos cerca":** filters for "Cerca de mí" or zone, date (today / 7 days / 14 days) and level. Results: Editorial shows cards; Command shows a dense table with a status column. Each item shows date and time, venue, zone, distance bucket, Radar slots left, level, positions and cost hint. |
| F4 | **Request a spot** | **Listing detail (sheet on mobile):** facts, rules (cancel less than 4 h ahead = fine of Q{amount}; pay on site), position select and message (≤280), then "Solicitar cupo". Afterwards it shows "Solicitud enviada". |
| F5 | **Decide** (admin) | **Match Detail → "Solicitudes Radar":** list with avatar, nickname, position, message and time. Actions: Aceptar, Rechazar (optional note) and Bloquear. A full match disables Aceptar. After an approval the app runs `upsertMatchFee` (as it does today) and refreshes the roster. |
| F6 | **Join and play** (approved outsider) | **`/radar` → "Mis partidos y solicitudes":** status chips (Pendiente / Aceptada / Rechazada / Retirada / Cancelada / Expirada). An accepted request shows the address, time, roster (nicknames), fee and payment status, and "Cancelar mi cupo", which warns about the fine when less than 4 h remain. |
| F7 | **Notifications** | Header bell in both experiences with an unread badge and a list that links to the request or match. "Marcar como leídas". Polling runs on focus and every 60 s. |
| F8 | **Existing screens** | The attendance list, Equipos, Cobros, Multas and stats show Radar attendees as "Apodo · Radar", from `radar_match_people`. The team builder treats them like guests (default rating). Members' screens are otherwise unchanged. |

Navigation:
- "Radar" appears in the sidebar, bottom navigation and header for every signed-in user, at `/radar`.
- Group onboarding gets a "Buscar partidos en Radar" entry, and `/radar` works without a selected group (C5).

---

## 4. Test strategy

| Level | What | Pass criteria |
| --- | --- | --- |
| SQL on Staging (new `supabase/staging/radar_mvp_tests.sql` plus a Node runner with synthetic users: G1 super_admin, G1 admin, G1 player, G2 admin, outsiders O1 and O2, a banned user) | **RLS matrix:** each role does direct `select/insert/update/delete` on every new table. O1 reads `matches`, `attendances`, `profiles`, `venues`, `match_fees` and `fines` of G1. | Only the rows allowed in §2.1. O1 gets 0 rows from every existing G1 table, before and after approval. |
| | **RPC rules:** publish validations (tags, past, no coordinates, slots > free, Radar off); requests by a member, a banned user, a duplicate, over the rate limit, or after closing; a decision by a non-admin or by G2's admin; approving when full; early and late cancellation; closing and disabling Radar; match canceled, rescheduled or deleted. | Each case gives the expected error or state, and notifications for the right recipients only. |
| | **Concurrency:** 20 parallel `radar_decide_request` calls, and parallel member `confirmAttendance` calls plus guest registrations, for the last slot of a Radar match. 10 parallel `radar_request_spot` calls by the same user. | Occupancy never exceeds `max_players`. Exactly one request row per user. No deadlocks; the lock order is always the match row first. |
| | **Privacy:** key-set assertion on every outsider RPC, plus a scan of the payloads. | No `match_id`, `group_id`, `phone`, `full_name`, address (before approval), `lat` or `lng`. |
| | **Regression:** a private match in G1 with confirm, cancel within 4 h, fee split, guest link, and confirming beyond `max_players` as admin. | Identical to today (the triggers are inactive without a listing). |
| Vitest | `radar/radarModel.js` (distance bucket labels, status labels, slot math, late-cancel window); the Radar page, listing sheet, request form validation, admin inbox actions and bell (mocked `api.js`); `/radar` routing without a group; fallback names in shared lists. | All existing tests (103) plus the new ones pass. |
| Playwright | `e2e/radar.spec.js`: both experiences, with a DEV-only demo module (like `src/dev/tournamentDemo.js`, removed from the production build): discover → request → admin accepts → "Mis partidos" → cancel; empty and error states; player versus admin visibility. | Green. |
| Screenshots | `scripts/radar-shots.cjs`: 2 experiences × 4 palettes × desktop, tablet and mobile for list, detail, requests, admin panel, inbox and bell. | No overflow and no console errors. |
| Staging QA | A local build and then the protected Preview against Staging run the full loop: publish → discover → request → approve → roster, fee and notifications → late cancel → fine → closing expires requests. Cleanup and a check for no Production requests. | All pass, and 0 synthetic leftovers. |
| Production (after release) | Read-only: zero-row RPC calls, `/radar` requires login, the policy fingerprint keeps every existing policy unchanged, and Radar starts disabled for every group. | Pass, then enable one pilot group. |

---

## 5. Implementation stages

| Stage | Content | Exit criteria | Needs authorization |
| --- | --- | --- | --- |
| 0 | Decisions in §7. Separately: the group waitlist fix (C2): reproduce on Staging, then add `waitlist` to `attendances_status_check` and remove `group_id` from `joinWaitlist`. | Decisions recorded; waitlist fix validated on Staging. | Decisions: yes. Waitlist constraint in Production: yes, separately. |
| 1 | Migration and RPCs on **Staging**, plus the SQL test suite (RLS, rules, concurrency, privacy, regression). | Suite green; migration safe to re-run on Staging. | Already within "work on Staging"? Please confirm. |
| 2 | `api.js` Radar functions, `radarModel.js`, notifications client and Vitest. | Green. | No (local). |
| 3 | Screens F1–F8, routing without a group, fallback names, demo module and Playwright. | Green; screenshots reviewed. | No (local). |
| 4 | Staging QA on a local build, then the protected **Preview** (which uses Staging). | QA green. | Preview: yes. |
| 5 | **Production:** migration first (additive, Radar disabled everywhere), then the frontend. Read-only smoke check. | Smoke check green; policy fingerprint shows existing policies unchanged. | Yes. |
| 6 | Pilot: enable Radar for one group and watch requests, cancellations and fines for 2 weeks. | Metrics: filled spots per week and the rejection rate. | Yes (which group). |

The rollback order is to disable Radar per group (immediate). Next, redeploy the previous frontend. Last, the tables can stay: the triggers are inactive when there are no listings.

---

## 6. Compatibility risks with existing matches and groups

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | The guest link accepts any match UUID (C1). This is pre-existing and also affects private matches. | Radar never exposes `matches.id`. Separate proposal: guest links get their own revocable token, or require an "invite" flag. That changes an existing public RPC and needs authorization. |
| R2 | The group waitlist is broken (C2). | Stage 0 fix, independent of Radar. Radar's pending queue does not use it. |
| R3 | The capacity trigger changes behavior on **Radar matches**: an admin or player can no longer confirm beyond `max_players` there. | This is intended. The UI shows "Lleno" plus the server message. Private matches are unaffected, and the regression tests prove it. |
| R4 | Outsiders don't appear in screens that join `profiles` (C4). | Fallback names through `radar_match_people` in attendance, Equipos, Cobros, Multas and stats. Covered by Vitest and screenshots. |
| R5 | An approval changes the per-player fee for everyone. That is today's rule whenever someone confirms. | The approval dialog shows "La cuota por jugador pasará de Q{a} a Q{b}". |
| R6 | Late cancellation creates a fine for a non-member, who can see it only in Radar. Payments by outsiders happen on site in the MVP. | Shown in "Mis partidos". The admin marks it paid in Multas or Cobros as today. |
| R7 | Matches restricted by `allowed_tags` contradict a public listing. | Publishing is blocked while tags are set. |
| R8 | A match is edited, canceled or deleted after approvals. | `radar_notify_match_change` trigger. Deleting cascades the listing and requests, and notifications keep their text. |
| R9 | Time zones: the 4-hour rule and "upcoming" are computed today in the browser's time zone. | The RPCs use an explicit time zone (D5), and the UI uses the same value. |
| R10 | An inactive member still counts as a member (`is_group_member` ignores `is_active`). | Such people cannot request through Radar; the group flow applies. |
| R11 | Notification polling load. | 60 s plus on focus, an indexed unread count, and no realtime in the MVP. |
| R12 | Abuse: spam requests or fake profiles. | Rate limits, a nickname requirement, group bans, admin approval for everything, and Radar off by default. |

---

## 7. Decisions needed before building

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | How do outsiders pay their share? | **On site.** The admin marks it in Cobros. Proof upload for outsiders comes later. |
| D2 | Do late-cancellation fines apply to outsiders? | **Yes**, the same 4 h rule and the group's amount. |
| D3 | Who enables Radar for a group? | **super_admin** (same as Configuración). Admins publish individual matches. |
| D4 | Show the group name on listings? | **Off by default** ("Grupo privado"); each group can opt in. |
| D5 | Time zone for the rules | **`America/Guatemala`** (the app uses Q). Confirm, or make it a group setting. |
| D6 | Level band | Chosen by the admin per listing. There is no self-declared player level in the MVP. |
| D7 | Stage 0 waitlist fix and the R1 guest-link hardening | Authorize them separately; the MVP does not depend on them. |
| D8 | Pilot group | To be chosen by you. |
