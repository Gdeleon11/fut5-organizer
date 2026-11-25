# F5 Manager — Onboarding comercial V1

Branch `feat/f5-onboarding-v1` (from master `14d68a9`). Validated on **Staging only** with synthetic accounts that are deleted afterwards. No migrations, no RLS changes.

## Recorrido medido (Staging, teléfono 390×844)

| | Antes | Después |
|---|---|---|
| Visitante nuevo en `/` | Redirigido a `/partidos` → login; **nunca veía la landing** | Landing con propuesta de valor; CTA «Crear mi cuenta gratis» abre el registro directamente |
| Organizador: landing → primer partido | 6 pantallas / 17 acciones (sin landing) | 6 pantallas / 17 acciones (con landing incluida) |
| Invitar al grupo | Había que abrir el partido y buscar el bloque de WhatsApp | Tarjeta «Invitá a tu grupo» en Partidos: WhatsApp o copiar enlace (1 toque) |
| Amigo sin cuenta abre el enlace | Login genérico, sin contexto | Registro directo con «Te invitaron a un grupo de F5 Manager…» |
| Amigo: enlace → dentro del grupo | 2 pantallas / 10 acciones | 2 pantallas / 9 acciones |
| Organizador activa al amigo | Sin aviso; Jugadores filtra «activos» y el pendiente no aparecía | Tarjeta «1 jugador espera que lo actives» en Partidos → «Activar» (1 toque) |
| Contraseña olvidada | No existía | «¿Olvidaste tu contraseña?» → email → pantalla «Nueva contraseña» |

The checks: 23/23 on the after-journey, 21/23 → 23/23 during the fixes; the baseline failed P1, E1, E2, E3, G1, F1, A1 and crashed at activation.

## Problemas comprobados y soluciones

| Id | Problema | Solución |
|---|---|---|
| P1 | `/` sin sesión nunca mostraba la landing (también en Production): `resetState()` corría en `INITIAL_SESSION` nulo | Resetear solo en `SIGNED_OUT` |
| E1/E3 | Errores de Supabase en inglés («Invalid login credentials», «email rate limit exceeded»…) | `authMessages.js`: traducción; un texto inglés desconocido nunca se muestra crudo |
| E2 | Sin recuperación de contraseña | Modo «Recuperar acceso» (mensaje neutro, sin revelar cuentas) + `NewPasswordScreen` en el evento `PASSWORD_RECOVERY` |
| G1 | Tras crear el grupo no había forma visible de invitar | `OnboardingCards`: invitación por WhatsApp para admins con menos de 4 jugadores activos |
| F1 | El invitado no sabía a qué grupo entraba | Banner de invitación en el registro. Sin sesión no se puede leer el nombre (`search_groups_public` exige sesión), así que se muestra genérico y no hay cambio de base de datos |
| L1 | Enlace inválido: error técnico | «Ese enlace de invitación no es válido o el grupo ya no existe…» |
| A1/A2 | El admin no se enteraba de los pendientes | Tarjeta de pendientes con «Activar a <nombre>» en Partidos |
| Mi FIFA | — | Sugerencia opcional y descartable («No hace falta para jugar»); nunca bloquea |
| Landing | Métricas inventadas (+10.000 / 99,4 % / 100 %) | Reemplazadas por hechos: Gratis · Por WhatsApp · Equipos parejos |
| Regresión | «Mis estadísticas» (Jugadores) y `SelfStatsCard` escribían directo en `match_player_stats`, bloqueado por RLS desde Player Evolution (**afecta Production**) | Solo lectura + «Cargar o corregir en el Postpartido» |
| Campeonatos | Fecha del primer partido solo en formato numérico | Debajo del campo: «Primer partido: martes, 1 de diciembre de 2026…» |
| Campeonatos | La final quedaba recortada en llaves en teléfono | Las rondas se apilan en vertical por debajo de 720 px (con prueba e2e) |

Radar: the journey doesn't require it or publish anything. The no-group screen keeps «¿Solo querés jugar? Buscar partidos en Radar» as an option.

## Pruebas

- Vitest: 200/200, including 9 new ones in `auth-messages.test.js`.
- Playwright: 135 passed, 1 skipped (mobile and desktop).
  - New `e2e/onboarding.spec.js`: landing, Spanish errors, neutral recovery, invitation with name, generic invitation, invalid link, organizer cards and one-tap activation.
  - `tournaments-admin.spec.js` now asserts the final fits inside the screen.
- Build OK.
- Staging journey: 23/23.
  - Landing → registration → profile → group → first match → invitation link.
  - Friend: registration → automatic join → activation from Partidos → confirmation.
  - A player sees no admin cards.
  - Invalid link.
  - Isolation: a user outside the group reads 0 matches.
  - Recovery: the link opens «Nueva contraseña» and the new password works.
  - 2 designs × 4 palettes, phone and desktop, no overflow.
  - No exceptions or Production requests.
  - Cleanup OK.

## Pendiente / fuera de alcance

- Showing the group name to a signed-out invitee needs a public RPC limited to name-by-id. That is a migration, so it isn't in this V1.
- The Staging and Production redirect URLs must allow `/login` so the recovery email returns to the app. Check this in Supabase Auth before Production.

## Release log — Production (25/11/2026)

- Approved by the owner («Yes, production»).
- master fast-forwarded `14d68a9 → d04a124`.
- Vercel deploy `o17zgnihd` (production, READY, commit d04a124).
- No migrations, no RLS changes and no data written.
- Read-only smoke test on f5manager.lat (phone), 7/7:
  - landing at `/` with «Crear mi cuenta gratis», without the invented metrics;
  - the CTA opens sign-up;
  - «¿Olvidaste tu contraseña?» is present;
  - the invitation banner shows;
  - no overflow and no exceptions.
- The bundle references only the Production project.
- Rollback: promote the previous deploy `jo8v4rsxg` (commit 14d68a9) in Vercel.
