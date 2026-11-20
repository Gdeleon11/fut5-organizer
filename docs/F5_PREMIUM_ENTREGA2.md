# F5 Premium — Entrega 2: Jugadores y Mi FIFA

Rama `feat/f5-premium-players` (desde `master` `fddc078`). Commits locales, sin push ni despliegue.

## Qué cambió
| Área | Matchday Editorial | Sports Command Center |
|---|---|---|
| Directorio | Lista tipográfica numerada (nombre, posición, PJ/G/A/MVP, nivel) | Fichas con posición, nivel, barras de goles/partidos y métricas del plantel |
| Ficha de jugador | Nombre gigante + carta FIFA, secciones con filetes | Héroe con carta + identidad + métricas, tablero de paneles |
| Ranking | Podio en columnas con filetes y tabla editorial | Podio elevado, tabla de marcador y paneles |
| Mi FIFA | Identidad tipográfica + carta protagonista, dos columnas | "Vestuario": héroe con carta y métricas, paneles |
| Formularios | Edición de perfil, roles, subgrupos, notificaciones y estadísticas propias con el sistema `md-form` | idem con paneles Command |

Común: búsqueda, filtros (estado, posición, orden; filtros admin "sin estrellas" y "multas abiertas"), estados vacíos, evolución por partido **solo con ≥3 partidos con estadísticas**, acceso a Apariencia conservado.

## Reglas respetadas
- **Estadísticas:** `players/playerStats.js` contiene las fórmulas movidas tal cual del antiguo Ranking (goles, asistencias, MVP, vallas, PJ, confiabilidad = confirmaciones − cancelaciones − 2×ausencias, voto). No se inventan métricas ni se cambia la carta FIFA ni la puntuación.
- **Privacidad (solo UI; RLS intacto):** teléfono, nombre completo, tags y multas solo los ve el propio jugador o la administración. Antes la ficha los mostraba a cualquier miembro.
- **Permisos:** activar/desactivar y cambiar posición solo para administradores (antes se ofrecían a todos); estrellas, tags, habilidades y capacidades siguen siendo solo Super Admin.
- **F5 Passport (preparación):** `components/profile/ProfileBlocks.jsx` agrupa identidad, métricas, habilidades y evolución y solo recibe datos deportivos públicos. Radar y perfiles públicos no se implementaron.

## Validación
- Vitest 75/75 (8 nuevas de Entrega 2), `vite build` sin código de demo/DEV.
- Playwright 57/57 + 1 omitida a propósito (escritorio y móvil), incluidas las regresiones de Entrega 1, Apariencia, seguridad y navegación.
- 96 capturas reales (2 experiencias × 4 paletas × escritorio/tablet/móvil): `review-shots/e2/full/` (local, fuera de git). Script: `frontend/scripts/e2-shots.cjs`.

## Pendientes
- Validación en Preview con cuentas sintéticas de staging (el grupo sintético tiene 2 miembros; para ranking y evolución con datos reales hacen falta más partidos con estadísticas).
- "PJ" usa la fórmula existente (asistencias en partidos con estadísticas); con los datos demo da 0 aunque haya asistencias.
- `SkillDistribution` y la carta FIFA conservan su estilo propio (no se tocaron por ser parte del modelo de puntuación visual).
