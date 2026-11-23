# F5 Player Evolution — coordinated Production release plan (DB + front end)

Status: **plan only — not executed.** Requires a new explicit approval. Production project: `iijrkeshjpjmxdsclnmo`.
Never `supabase db push` / `--include-all`. Two migrations, in this order:
`20261123100000_player_evolution.sql`, then `20261123120000_postmatch_match_validator.sql` (depends on the first).

## Why DB and front end must ship together

- The migration removes `match_player_stats_manage_own` (players writing their own official stats) and limits
  `match_player_stats_manage_admin` to rows that are not the admin's own. The **current** front end (master `e9e32b0`)
  still has the old survey and the "Cargar estadísticas" editor, which rely on those writes.
- The **new** front end without the migration hides Player Builder, Postpartido and the survey (safe), but it has
  no stats editor — nobody could record stats.
- So: apply the migration, then deploy the front end immediately (minutes apart), in a quiet hour.

## 0. Go / no-go (read-only, Production)

1. `supabase migration list --linked` → only `20261123100000` and `20261123120000` pending; nothing else pending or unknown.
2. No name collisions: none of `player_styles, match_events, match_corrections, match_event_history, match_mvp_votes,
   match_postmatch, match_validators`, no `postmatch_*` / `pe_*` functions, no `match_player_stats.source` column (all checked 0 on 2026-11-23).
3. Dependencies exist: `is_group_member(uuid)`, `is_group_admin(uuid)`, `shares_group_with(uuid)`, tables
   `teams`, `team_members(profile_id)`, `attendances(checked_in)`, `matches(start_time)`, `player_ratings`.
4. Snapshots saved locally (not in git):
   - full `pg_policies` fingerprint (md5 of name+qual+check per table) — compare after;
   - `match_player_stats`: row count, `sum(goals)`, `sum(assists)`, `count(*) filter (where mvp)`;
   - current `match_player_stats` policy definitions (rollback, below).
5. Exact commit to release passes Vitest, build and Playwright (re-run on that commit).

## 1. Database (Production)

1. `supabase db query --linked -f supabase/migrations/20261123100000_player_evolution.sql`
   (single transaction; on any error nothing is applied → stop, no front-end deploy).
2. `supabase migration repair --linked --status applied 20261123100000`.
3. `supabase db query --linked -f supabase/migrations/20261123120000_postmatch_match_validator.sql`, then
   `supabase migration repair --linked --status applied 20261123120000`. If this second one fails, the first is still
   valid on its own (single-admin groups simply keep their own data pending) — stop and report before the front end.
4. `supabase db push --linked --dry-run` → "Remote database is up to date" (dry run only).

### Post-DB checks (read-only)

- 7 new tables (incl. `match_validators`) exist with RLS enabled; `anon` has no grants; `authenticated` has SELECT only on the postmatch tables and
  SELECT/INSERT/UPDATE on `player_styles` (own row only by policy).
- 9 `postmatch_*` functions (incl. `postmatch_set_validator`, `postmatch_revoke_validator`) executable by `authenticated`,
  not by `anon`; 8 `pe_*` helpers not executable by clients; history action CHECK includes `validator_designated/revoked`.
- `match_player_stats` policies = `match_player_stats_select_member` + new `match_player_stats_manage_admin`
  (`... AND player_id IS DISTINCT FROM auth.uid()`); `manage_own` gone.
- Policy fingerprint of every **other** table unchanged.
- `match_player_stats` count/sums/MVP count unchanged; every existing row has `source = 'legacy'`.
- No rows in the new tables.

## 2. Front end

1. Fast-forward `master` to the approved branch commit (no force); re-run Vitest/build/Playwright on it.
2. Normal push → Vercel Production deployment Ready, aliased to f5manager.lat.
3. Bundle scan: Production ref only; no Staging ref, demo/mock code, `sb_secret`, `service_role`.
4. Keep the previous deployment (`fut5-organizer-n2cnxlcsn`, master `e9e32b0`) for rollback.

## 3. Post-release checks

- Read-only public smoke (32 checks) + anon cannot call `postmatch_*` / read `player_styles` / postmatch tables (401/42501).
- Signed-in, read-only, with the owner's own session: Mi FIFA shows the three layers; a past match shows Postpartido;
  a match with teams shows the balance explanation. No writes in Production without explicit approval.
- Radar pilot unchanged (1 open listing, Zona 2, 4 spots); Radar functions do not read any new table (verified on Staging:
  0 of 33 Radar functions reference stats, styles, ratings, votes or postmatch).
- Re-check `match_player_stats` snapshot equality after 24 h (only `source = 'postmatch'` rows may be new).

## 4. Rollback

- **Front end:** promote `fut5-organizer-n2cnxlcsn`.
- **Database:** do not drop the new tables (additive; dropping loses new data). If and only if the old front end is
  restored, recreate the old `match_player_stats` policies so its survey/editor work again:

```sql
BEGIN;
DROP POLICY IF EXISTS match_player_stats_manage_admin ON public.match_player_stats;
CREATE POLICY match_player_stats_manage_admin ON public.match_player_stats FOR ALL TO authenticated
  USING (public.is_group_admin(group_id)) WITH CHECK (public.is_group_admin(group_id));
CREATE POLICY match_player_stats_manage_own ON public.match_player_stats FOR ALL TO authenticated
  USING (player_id = auth.uid() AND public.is_group_member(group_id))
  WITH CHECK (player_id = auth.uid() AND public.is_group_member(group_id));
COMMIT;
```

## 5. Open decisions before release

1. MVP quorum stays at max(3, half the roster) + single winner (approved provisionally). Note: a 4-player roster needs 3 votes (75%).
2. Single-admin groups: "validador del partido" chosen and implemented (Staging); ships with the second migration.

## Release log — 2026-11-23 (executed)

- Pre-checks: master `e9e32b0` → fast-forward to `edd4c4c`; only the two migrations pending; no name conflicts;
  dependencies present; backups saved locally (policy fingerprint `62dcdcf3…`/96, all 674 `match_player_stats` rows).
- Final tests on `edd4c4c`: Vitest 191/191, build OK, Playwright 125 + 1 skipped, Staging rules 54/54, async FIFA-card
  check 5/5 (style shows "Cargando…" then loads).
- `20261123100000` applied with `db query -f` (file md5 identical to the commit) and recorded; verified: 6 tables RLS on,
  anon none, 7 client / 6 internal functions, `match_player_stats` = select_member + manage_admin (not own row),
  other 93 policies unchanged, 674 rows identical (md5 `db8b0afa…`), all `source = legacy`, new tables empty.
- `20261123120000` applied and recorded; `db push --dry-run` → up to date. 18 functions and 11 policies byte-identical to
  Staging; `match_validators` RLS on, anon none, empty; 9 client / 8 internal functions.
- Note: `authenticated` has Supabase's default table privileges on the new tables (same as every existing table and as
  Staging); access is governed by RLS (player_styles: read group mates, insert/update own row, no delete).
- Front end: master pushed `e9e32b0..edd4c4c`; deployment `fut5-organizer-khmjaprp5` (`dpl_B1yQvW1yEhXH4XieuRvfSKki5sGM`)
  Ready on f5manager.lat; bundle: Production ref only, no Staging/demo/mock/synthetic/secret strings.
  Rollback target kept: `fut5-organizer-n2cnxlcsn` (`e9e32b0`).
- Post checks: public smoke 32/32; anon 401 on the 7 new tables and on postmatch/pe functions; Radar pilot unchanged.
- Pending: signed-in checks in Production (no authorized session used in this release).
