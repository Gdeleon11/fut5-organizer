# F5 Player Evolution — identity, stats and fair teams (branch `feat/f5-player-evolution`)

Built from master `e9e32b0`. Not pushed, not deployed. The database part exists **only on Staging**.

## A. Player Builder (Mi FIFA)

- Optional "Crear mi estilo": main position (the existing `profiles.preferred_position`), optional secondary position,
  and **10 points** across Ataque, Defensa, Pase/visión, Ritmo/resistencia and Portería (exactly 10; server CHECK).
- Clearly labelled **Autodeclarado**: never touches `player_ratings` (official, admin-only), stats or awards.
- Mi FIFA now shows three layers: **Estilo** (self-declared), **Verificado** (played matches, confirmed goals/assists,
  official MVPs, the admin rating) and **Logros** (earned only from verified data — nothing is invented for new players).
- Photo and profile are untouched; changing the main position keeps name, nickname and phone.
- Privacy: `player_styles` is readable by the owner and people who share a group with them; nothing goes to Radar.

## B. Postmatch

| Rule | How |
|---|---|
| Eligible participants = real lineup | generated teams → else checked-in → else confirmed (`pe_participants`) |
| Easy entry | 2-step optional survey on the phone (your numbers, MVP vote) + a Postpartido panel in the match |
| Provisional vs confirmed | self-reported data is **provisional**; an admin entering someone else's data confirms it |
| No self-validation | nobody can confirm or accept a correction to their **own** data — an admin who also played needs another admin |
| Corrections | any participant can request one (optionally proposing the right value); admins accept/dismiss |
| History | append-only log of every report, change, decision, correction and closing (not editable, even by admins) |
| MVP | one vote per participant, changeable until closing, never for yourself; results hidden until the admin closes |
| Insufficient participation | official MVP only if voters ≥ max(3, half the lineup) **and** a single leader; otherwise "Sin MVP oficial" with the reason |
| Official stats | written only by server functions from confirmed events; historical rows (`source = legacy`) are never overwritten |

Permission changes (tightening, Staging only): players can no longer write `match_player_stats` directly
(they could set their own goals/MVP before), and admins cannot write **their own** row. The old "Cargar estadísticas"
editor is replaced by "Ir al postpartido".

## C. Balanced teams

- Only confirmed, active players and the match's guests; duplicates removed.
- **Strength** = (1 − w)·prior + w·performance, w = n/(n+5): prior is the admin's official rating, or the **group
  average for new players** (not penalised); performance uses confirmed goals/assists/MVP/clean sheets per match.
  With 5 verified matches results weigh 50%.
- Self-declared style **never changes strength** (10 points always add up to 10); it sets the line (DEF/MED/DEL) and
  marks goalkeepers (main/secondary position or ≥ 4 points in Portería).
- Goalkeepers and lines are spread across teams; the organizer can **pin** players and "Regenerar sin mover a los fijados".
- A short explanation for everyone: level (muy parejo / parejo / algo desigual / desigual), average per team,
  goalkeepers and lines per team, and notes (new players, pins, missing goalkeepers). Individual numbers are not shown.

### OpenSkill.js — evaluated, not introduced

OpenSkill (Weng-Lin / TrueSkill-like) rates players from **team results** with uncertainty, which fits 5-a-side well.
Not adopted now because:
1. F5 does not record per-team match results (score / winner per generated team) yet, which OpenSkill needs.
2. Groups play few matches; with little data the uncertainty term dominates and teams would not improve visibly.
3. It would add a rating that players cannot easily understand, against "confiar en que los equipos sean parejos".

Revisit when: team results are recorded for most matches and a group has ≥ 15 matches with stable lineups. The
current `enrichPlayers` keeps a single `strength` input, so OpenSkill's μ could replace the performance term later.

## Tests

- Vitest 188/188 (new: Player Builder 8, Postmatch 8, balanced teams 8; updated demo/match tests).
- Playwright 125 passed + 1 skipped (desktop + mobile).
- Staging database suite `frontend/scripts/qa-staging/player-evolution-suite.cjs`: 40/40.
- Staging browser QA (local build, synthetic users, removed): 29/29 — survey, provisional/confirmed, admin-player,
  second-admin validation, correction, history, MVP quorum, style save, verified layers, explanation, pins,
  player read-only view; no JS/console/HTTP errors; no Production requests.

## Before Production (blocking)

1. Apply `supabase/migrations/20261123100000_player_evolution.sql` to Production (additive + two tightened policies),
   with explicit approval, **in the same release as the front end**. Without it the app does not break (Player Builder,
   Postpartido and the survey hide themselves; balanced teams still work from ratings and stats), but the old
   "Cargar estadísticas" editor is gone, so there would be no way to record stats until the migration is applied.
2. Decide the MVP quorum rule (proposed: max(3, half the lineup) and a single leader).
3. One-admin groups: an admin's own goals stay pending until a second admin exists — confirm this is acceptable.

## Single admin — "validador del partido" (implemented on Staging 2026-11-23)

Reproduced on Staging: when the only admin plays, their own goals/assists stay **provisional** forever — they cannot
confirm them, no player can, and a correction to their own data cannot be accepted by them. The match can still be
closed; their data simply never becomes official. Nothing leaks: the gap is "unverified", never "self-verified".

**Implemented — migration `20261123120000_postmatch_match_validator.sql`** (one validator per match):
- The admin may designate **one participant of that match** (not themselves) as validator, only when the group has
  no other active admin who played or can validate.
- The validator can confirm/reject **only the admin's own provisional events of that match** and resolve corrections
  about those events. Nothing else: no other players' data, no closing, no MVP, no roles, no other matches.
- Visible to everyone in Postpartido ("Validado por X, designado por el admin") and written to the history.
- Revocable only while unused (no swapping after a rejection); ends when the postmatch is closed. A validator can never validate their own data.
- Schema scope: one table `match_validators (match_id PK, validator_id, designated_by, created_at, revoked_at)`,
  one RPC to designate/revoke, and one extra condition in `postmatch_decide` / `postmatch_resolve_correction`.
  No change to roles, group permissions or RLS of existing tables.
- Residual risk: the admin picks a friendly validator. Mitigated by transparency (history, visible label) and the
  one-validator-per-match limit.

Alternatives considered: (b) peer ratification — the admin's event confirms when 2 other participants agree (no
designation, more friction, harder to explain); (c) keep as is — admin's own stats stay unverified.

## MVP participation (evaluated 2026-11-23)

Quorum = max(3, half the roster) + one winner, tested with rosters of 4, 6, 10, 14 and 18 and 1 → 50% turnout:
below the quorum there is never an official MVP and nothing is written to the stats that feed balance/ratings.
Small rosters are strict (4 players → 3 votes = 75%); large rosters need half (18 → 9).

## Protected Preview validation (2026-11-23)

- Preview: `https://fut5-organizer-qskbbu3la-guillermo-de-leons-projects.vercel.app` — deployment
  `dpl_ZPJPMExwExmzxVJ94aVH8PxAyTy5`, commit `edae0aa`, Vercel Authentication on (302 to login without a token),
  Supabase Staging only (no Production ref, no demo/mock code, no secrets in the bundle).
- Staging rules suite 40/40; special cases (single admin, MVP by roster size) 10/10.
- Browser QA on the Preview with synthetic accounts: 46/47, plus a targeted re-check 5/5 for the one failed step
  (the script read Gato's card before its data had loaded; the card itself was correct). Covered A, B, C as admin and
  player, historical stats unchanged, and the full matrix 2 designs × 4 palettes × desktop/mobile (16/16, no overflow,
  no JS/console/HTTP errors, no Production requests).
- Radar: 0 of 33 Radar functions and no Radar screen read stats, styles, ratings, MVP votes or postmatch data.

Validation of the validator (Staging): rules suite 54/54 (14 new checks V1–V14: only a sole admin who played may
designate; not themselves, not a non-participant, not by a player; groups with another admin cannot use it; the
validator decides only the admin's events and corrections; another player or a revoked validator cannot; rights do not
carry to another match; used → no revoke/swap; closing ends the role; nobody writes `match_validators` directly).
Browser QA 13/13 (sole admin designates on desktop; validator confirms on the phone; history; no errors).
Vitest 191/191, Playwright 125 + 1 skipped.
