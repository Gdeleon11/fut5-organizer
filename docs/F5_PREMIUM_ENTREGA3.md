# F5 Premium — Entrega 3: Cobros, Tesorería, Multas, Reservas y Sedes

Branch `feat/f5-premium-finance-reservations` (from `master` @ `bf68240`). Local only, not pushed or deployed.

## What changed

| Area | Matchday Editorial | Sports Command Center |
| --- | --- | --- |
| Cobros shell | Typographic hero with the balance in the lede and underline tabs with badges | Command bar with balance, receivables and pending-review pills; pill tabs |
| Caja y finanzas | Balance statement (income / expense / balance), dotted leaders, ledger table grouped by month, side column with distribution and the expense form | KPI board, cash-flow panel (collected ring, income sources, income vs expense bar), movement feed |
| Cobros y cuotas | Match fees and collections as statements with a progress line and a payments table | Cards with a progress ring and payment rows; KPI row |
| Comprobantes | Shared proof-review modal (`md-modal`) with player, amount, approve and reject with an optional reason; status chips always carry a text label | Same modal |
| Multas | KPI row, date-range filter, fines table | Fine cards with a status stripe |
| Reservas | Hero agenda; the month calendar is the default view, with day detail | Operations KPIs (pending, without proof, confirmed, assisted); cards are the default view |
| Reservation cards | Step tracker (assigned → proof → confirmed), WhatsApp, link, upload, confirm | Same tracker |
| Sedes | Editorial catalog (photo, name, cost, usage stats) | Venue card grid |

Both experiences keep the four palettes, because only `--md-*` tokens are used.

## Rules kept unchanged

- `src/finance/financeModel.js` is a verbatim extraction of the formulas that were previously inline in the pages:
  - treasury totals, receivables and the ledger;
  - collection summaries and the WhatsApp text;
  - player debts;
  - fine visibility and date ranges;
  - venue history;
  - reservation ordering and limits;
  - the assisted-reservation filter.
- `src/__tests__/finance.test.jsx` compares the model against copies of the original code on 40 deterministic fixtures.
- All writes still go through the same App.jsx handlers with the same payloads:
  - fee and collection payments (`paid` / `forgiven`);
  - proof review;
  - fines;
  - expenses;
  - collections;
  - reservations;
  - venues.
- Permissions are unchanged:
  - players only see their own fees and fines;
  - only admins get settle, review, expense, collection and fine actions;
  - only super admins can delete a pending reservation;
  - confirming a reservation still requires a proof;
  - only the owner or an admin can change an assisted reservation.

## Additions that are presentation only

- Ledger filter (all / income / expense).
- Calendar view and month navigation.
- The "cobrado" ring, which shows collected ÷ (collected + receivable). It is a display ratio, not a rule.
- KPI counts.
- A negative balance now shows its minus sign. Before, it was only shown in red.

## Evidence

- Vitest: 89/89 (14 new).
- Playwright: 67 passed and 1 intentionally skipped, including `e2e/finance-reservations.spec.js` with 10 new tests on desktop and mobile.
- `npm run build`: OK, with no demo code in `dist`.
- Screenshots: `node scripts/e3-shots.cjs ../review-shots/e3/full` produces 180 captures with 0 overflow or JS issues.
  - Coverage: 2 designs × 4 palettes × desktop/tablet/mobile.
  - Pages: Caja, Cuotas, proof modal, Multas, Reservas (calendar, cards, list), the reservation form, and Sedes.
  - Also includes the player role.
- The data is local demo data only. The demo fines and dated expenses were added inside the DEV-only demo loader.

## Pending

- The public token pages (`/reserve/<token>` and the proof upload link) live outside the appearance system on purpose, as public pages. Restyling them needs a decision on whether public pages adopt the user's design.
- A staging validation with real Supabase data has not been run for this delivery.
- The existing message "Partido creado desde la reserva (Simulación Local)." also appears outside demo mode. It is not changed here, because that is behaviour text.
