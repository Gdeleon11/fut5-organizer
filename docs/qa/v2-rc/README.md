# F5 Manager V2 — Release Candidate checks (2026-11-19)

Base `2b25634` (visual direction frozen). Only the five requested points were addressed.

| # | Point | Result | Evidence |
|---|---|---|---|
| 1 | Staging schema drift (`fines.created_at` …) | Staging lacked **88 columns** vs production in existing tables (fines, collections, group_expenses, profiles.group_tags, matches reservation fields, tournaments…). Applied `supabase/staging/20261119_staging_schema_parity.sql` **to staging only** (ADD COLUMN IF NOT EXISTS with production types/defaults; schema read from `information_schema`, no data copied; no FK/index/RLS/function changes). Re-diff: 0 missing. App session on staging: 0 REST 4xx. Production untouched (repo link still `iijrkeshjpjmxdsclnmo`; staging applied through a separate temp workdir). | `rc-checks.json` → `staging-rest-no-4xx` |
| 2 | Bottom nav green blocks at 768 px | **Real defect** (also on master): legacy item styles only existed < 720 px, so 720–899 px items used the global green `<button>`. Fixed in `matchday.css` for 720–899 px only (375 px labels unchanged). | `bottomnav-*-768/820`, new e2e test |
| 3 | Command dock at 375/412 | Dock sits above the bottom nav (CTA bottom 724 vs nav 737 @375; 827 vs 840 @412); after scrolling, every card/button ends above the dock; history row and "Crear partido" submit are clickable. Dock offset and nav padding both add `env(safe-area-inset-bottom)`. No change needed. | `dock-*` |
| 4 | Demo banner / test galleries in production | Production build: real session shows no "Modo desarrollo" banner (`DevRoleBanner` renders only when `isDemoMode`); `?f5-gallery=1` is ignored; gallery code absent from the bundle (0 matches). | `rc-prod-checks.json` |
| 5 | Editorial default, saved choices kept | Account without preference → Matchday Editorial + F5 Neon (nothing written on load); saved choices of A (editorial/light) and B (command/midnight) load unchanged. No code change needed. | `rc-prod-checks.json` |

Suites: Vitest 55/55 · Playwright 26/26 (desktop + mobile, incl. new 768 px test) · `vite build` OK.
Temporary servers (5173, 4173) stopped.
