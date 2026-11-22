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
   with explicit approval. The front end degrades safely without it (Player Builder and Postpartido stay hidden), but
   **team generation and the survey need it** for the new behaviour.
2. Decide the MVP quorum rule (proposed: max(3, half the lineup) and a single leader).
3. One-admin groups: an admin's own goals stay pending until a second admin exists — confirm this is acceptable.
