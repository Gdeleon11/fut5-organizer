# F5 Player Evolution — coordinated Production release plan (DB + front end)

Status: **plan only — not executed.** Requires a new explicit approval. Production project: `iijrkeshjpjmxdsclnmo`.
Never `supabase db push` / `--include-all`. One migration: `supabase/migrations/20261123100000_player_evolution.sql`.

## Why DB and front end must ship together

- The migration removes `match_player_stats_manage_own` (players writing their own official stats) and limits
  `match_player_stats_manage_admin` to rows that are not the admin's own. The **current** front end (master `e9e32b0`)
  still has the old survey and the "Cargar estadísticas" editor, which rely on those writes.
- The **new** front end without the migration hides Player Builder, Postpartido and the survey (safe), but it has
  no stats editor — nobody could record stats.
- So: apply the migration, then deploy the front end immediately (minutes apart), in a quiet hour.

## 0. Go / no-go (read-only, Production)

1. `supabase migration list --linked` → only `20261123100000` pending; nothing else pending or unknown.
2. No name collisions: none of `player_styles, match_events, match_corrections, match_event_history, match_mvp_votes,
   match_postmatch`, no `postmatch_*` / `pe_*` functions, no `match_player_stats.source` column (all checked 0 on 2026-11-23).
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
3. `supabase db push --linked --dry-run` → "Remote database is up to date" (dry run only).

### Post-DB checks (read-only)

- 6 new tables exist with RLS enabled; `anon` has no grants; `authenticated` has SELECT only on the postmatch tables and
  SELECT/INSERT/UPDATE on `player_styles` (own row only by policy).
- 7 `postmatch_*` functions executable by `authenticated`, not by `anon`; 6 `pe_*` helpers not executable by clients.
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
2. Single-admin groups: choose the validation option (see `F5_PLAYER_EVOLUTION.md` → "Single admin").
