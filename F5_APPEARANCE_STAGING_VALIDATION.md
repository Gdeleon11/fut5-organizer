# F5 Manager — Validación de preferencias de apariencia entre dispositivos (Staging)

- **Rama:** `feat/f5-matchday-themes` (base `f4a1e60`; correcciones en el commit que acompaña a este informe)
- **Fecha:** 2026-11-19
- **Entorno:** Supabase `Chamusca-Staging` (`ylynjvssjlmhzgmhkrsd`) + servidor Vite local temporal (`127.0.0.1:5173`)
- **Datos:** solo cuentas y datos sintéticos (`f5qa-appearance-a@f5manager.test`, `f5qa-appearance-b@f5manager.test`, grupo "QA Apariencia (sintético)", un partido "Cancha QA sintética")
- **Producción:** no se tocó. El bundle servido apuntaba solo a staging (verificado en `/src/supabaseClient.js`), y cada contexto de navegador **bloqueaba y registraba** cualquier petición a `iijrkeshjpjmxdsclnmo`: se registraron **0 peticiones**.
- **Sin** `git push`, sin despliegues, sin cambios de RLS, esquema, migraciones ni secretos.

## Resultado

| Bloque | Resultado |
|---|---|
| Pruebas obligatorias 1–10 + integridad (20 comprobaciones) | **20/20 PASS** |
| Las mismas 20 comprobaciones sobre el commit anterior `f4a1e60` | **15/20**: fallan 5, 7, 8, 9 y 9b (ver "Defectos encontrados") |
| Vitest | **55/55** (19 → 22 pruebas de apariencia/matchday) |
| Playwright (escritorio + móvil, incluidas las regresiones de seguridad y navegación) | **24/24** |
| `vite build` | OK |
| Auditoría de contraste de Club Light (36 pantallas × 2 diseños) | **0 incumplimientos de texto** (detalle abajo) |

**Dictamen:** la rama queda **lista para la revisión visual** y para la posterior aprobación del despliegue.

---

## 1. Defectos encontrados y corregidos antes de validar

Al revisar el código para planificar las pruebas aparecieron dos defectos reales. La prueba sobre `f4a1e60` los confirma: 15/20 en `docs/qa/appearance-staging/staging-results-f4a1e60-antes.json`.

1. **Metadata vieja al recargar.** `getSession()` devuelve el usuario guardado en caché, con la metadata de cuando se inició sesión. Por eso un dispositivo que se recargaba no veía el cambio hecho en el otro. En la prueba 7 el escritorio se quedaba en `command/gold`.
   **Corrección:** al cargar se vuelve a leer al usuario con `auth.getUser()`, que consulta Auth. Si no hay red, se usa la copia en caché.
2. **Fuga de preferencias entre cuentas en un dispositivo compartido.** La copia local de A era más reciente que la remota de B, así que se **subía a la cuenta de B**. En la prueba 9b, B quedaba con la paleta de A.
   **Corrección:** la copia local guarda `userId`. Si pertenece a otra cuenta, se ignora y se usa la preferencia remota del usuario que entra o, si no tiene, el valor predeterminado. `userId` **no** se escribe en Auth (comprobación 4c).

Cambios: `appearance.js` (`reconcileAppearance`, `toRemote`) y `AppearanceProvider.jsx`. Tienen pruebas unitarias nuevas que cubren la cuenta ajena, la metadata remota más reciente, la local más reciente y la ausencia total de preferencias.

## 2. Pruebas obligatorias (escritorio 1440×900 + móvil Pixel 7; contextos de navegador independientes y sesiones separadas)

Las sesiones se abrieron con `signInWithPassword` desde Node, con la cuenta sintética, y se inyectaron en el almacenamiento del navegador. Así las credenciales no se escribieron en ningún formulario.

| # | Prueba | Resultado | Evidencia |
|---|---|---|---|
| 0 | La cuenta A empieza sin preferencia en Auth | PASS | `staging-results.json` → `results[0]` |
| 1–2 | A abre sesión en escritorio y en móvil; sin preferencia ⇒ `editorial/neon` | PASS | `01_desktop_inicial.png`, `01_mobile_inicial.png` |
| 3 | Escritorio → Sports Command Center + Elite Gold, aplicado al instante | PASS | `03_desktop_command_gold.png` |
| 3b | Dos clics seguidos ⇒ **1** sola escritura `PUT /auth/v1/user` (debounce) | PASS | `evidence.authCalls` |
| 4 | Auth de staging (lectura admin) guarda `f5_appearance = {design: command, palette: gold, updatedAt}` | PASS | `results[4]` |
| 5 | Móvil actualiza la página ⇒ carga Command Center + Elite Gold | PASS | `05_mobile_command_gold.png` |
| 6 | Móvil → Matchday Editorial + Club Light, guardado en Auth | PASS | `06_mobile_editorial_light.png` |
| 6b | Sin actualizar, el escritorio sigue mostrando su valor anterior | PASS | *No hay tiempo real* (ver §4) |
| 7 | Escritorio actualiza ⇒ recupera Editorial + Club Light | PASS | `07_desktop_editorial_light.png` |
| 7b | Al cargar, el valor antiguo del escritorio **no** sobrescribe el más reciente (0 escrituras) | PASS | `results[7b]` |
| 8 | Cerrar sesión (token eliminado) e iniciar de nuevo en un contexto sin caché ⇒ Editorial + Club Light | PASS | `08_tras_cerrar_sesion.png` |
| 9 | Usuario B en el **mismo navegador** que A ⇒ ve sus propias preferencias (`command/midnight`) | PASS | `09_usuario_B_propias_preferencias.png` |
| 9b | Ni A ni B se sobrescriben al cambiar de cuenta | PASS | `finalMeta` |
| 10 | Red cortada en el guardado (`PUT /auth/v1/user` abortado): el cambio se aplica en local, la UI avisa *"Guardado en este dispositivo. No se pudo sincronizar…"* y se puede navegar a Partidos y Reservas | PASS | `10_error_red_estado.png` |
| 10b | Con la red restablecida, el siguiente cambio sincroniza | PASS | `results[10b]` |

Las capturas están en `review-shots/staging/`, una carpeta local excluida de git en `.git/info/exclude`. Los JSON con los resultados están versionados en `docs/qa/appearance-staging/`.

## 3. Integridad de datos

| Requisito | Resultado |
|---|---|
| Guardar preferencias no borra otros campos de `user_metadata` | **PASS.** Antes y después se conservan `full_name`, `nickname`, `phone`, `preferred_position`, `qa_marker` y el objeto anidado `qa_nested` (comprobación 4b). `updateUser({ data })` combina las claves con las existentes y solo escribe `f5_appearance`. |
| Roles y permisos no dependen de preferencias editables | **PASS.** B (jugador) se escribió a sí mismo `role: "super_admin"`, `is_admin: true` e `is_super_admin: true` en su metadata. Tras recargar sigue sin herramientas de admin (0 botones de "Nuevo partido", "Pizarra" o "Torneos") y `group_members.role = player` (`roles_b_sigue_jugador.png`). En el código, la metadata solo se usa para rellenar el perfil inicial (`api.js` `profileDefaults` y el trigger `handle_new_user`); los roles salen de `group_members.role` y `profiles.is_admin`. Al terminar se eliminaron esas claves de prueba. |
| Sin conflictos silenciosos; lo antiguo no pisa lo reciente | **PASS.** Gana la marca de tiempo más nueva: un valor remoto más reciente siempre se adopta (7) y al cargar no se escribe nada (7b). Cada cambio guarda `updatedAt = max(Date.now(), anterior + 1)`. *Limitación:* si dos dispositivos cambian la preferencia sin recargar entre medio, gana el último cambio realizado. Es intencional, porque es la última decisión del usuario. |
| Valor predeterminado si faltan preferencias | **PASS.** Sin metadata ni copia local ⇒ `Matchday Editorial + F5 Neon` (comprobación 1–2 y pruebas unitarias). Los valores inválidos o el JSON corrupto también caen en el predeterminado. |
| Sin errores ni bucles de actualización de sesión | **PASS.** **0** llamadas a Auth durante 8 s de inactividad. Totales de la prueba completa: escritorio 4 `GET /user` (cargas) + 3 `PUT /user` (3 cambios, uno de ellos en la prueba de red) + 1 `logout`; móvil 2 `GET` + 1 `PUT`. El evento `USER_UPDATED` que dispara cada guardado no provoca otra escritura. |

## 4. Alcance real de la sincronización

**No hay sincronización en tiempo real entre dispositivos.** Lo que hay:

- **En el mismo dispositivo:** el cambio se aplica al instante y se guarda en `localStorage`. Las otras pestañas del mismo navegador se actualizan solas mediante el evento `storage`.
- **Entre dispositivos:** el otro dispositivo recoge la preferencia **al abrir la app, al recargar o al volver a iniciar sesión** (comprobaciones 5, 6b y 7).

El texto del selector se ajustó a este comportamiento: *"Guardado en tu cuenta. Tus otros dispositivos lo cargan al abrir o actualizar la app."*

## 5. Club Light en pantallas internas

**Método.** Un escáner automático en navegador real (`frontend/scripts/qa-staging/light_scan.cjs`) calcula el contraste WCAG de cada texto visible frente a su fondo efectivo: combina capas semitransparentes y degradados, y omite fotos. Se pasó por 18 pantallas en 2 tamaños (1280 y 375) y en los 2 diseños, es decir, 72 vistas. Se hizo en modo demo: datos locales, con las peticiones a `*.supabase.co` bloqueadas. Además se revisaron las capturas a ojo.

**Pantallas:** Partidos y formulario de crear partido; detalle del partido (jugadores, equipos, pestaña de partido y panel admin); pizarra táctica; Reservas; Cobros (Caja, Cobros y cuotas, Multas); Jugadores (lista, Subgrupos y tags, Subir estadísticas, Ranking); Mi FIFA; Torneos; Grupos.

**Problemas encontrados y corregidos** (los dos últimos afectaban también a las paletas oscuras):

| Problema | Antes | Corrección |
|---|---|---|
| Botón heredado por defecto: texto negro sobre el acento | 3,87:1 | Texto blanco en Club Light (6,6–7,1:1). Acento claro más oscuro: `#0a6633` |
| Detalle de partido: cabecera y panel admin con fondo oscuro fijo ⇒ títulos oscuros sobre oscuro, prácticamente invisibles | ~1,2:1 | `.f5-card--hero/--glass` usan los tokens de la paleta |
| Franja del CTA fijo del detalle de partido en móvil, oscura fija | — | Usa el token de fondo |
| Pestaña activa al pasar el ratón: relleno verde heredado | 3,07:1 | Sin relleno al pasar el ratón (todas las paletas) |
| Píldoras "activo", "Confirmado" y contadores del ranking (acento sobre su tinte) | 4,0–4,2:1 | Verde más oscuro (≥ 4,9:1) |
| Insignias del podio y rangos de habilidad (colores pastel pensados para fondo oscuro) | 1,05–2,0:1 | Variantes oscuras solo para Club Light |
| Estrellas llenas | 3,93:1 | `#8a5300` (5,6:1) |
| Insignia del contador de pestañas (texto negro fijo) | 2,96:1 | Usa el token `--md-accent-ink` |
| Botones de WhatsApp: blanco sobre `#25D366` (en todas las paletas) | 1,98:1 | Texto `#06210f` (8,6:1) |
| Botón ✏️ con color blanco | — | Usa el color de texto de la paleta |

**Resultado final:** 0 textos por debajo de AA en las 72 vistas. Lo único que queda señalado son las **estrellas vacías** (★ en `#7d8a81`, 3,19:1). Son un indicador gráfico, no texto, y WCAG 1.4.11 les exige 3:1, que cumplen. Las capturas están en `review-shots/club-light/` y los datos en `docs/qa/appearance-staging/light-scan-*.json`.

**Límites:** el escáner no evalúa texto sobre fotos (cabeceras con imagen ni la tarjeta FIFA) ni bordes de controles. Esas zonas se revisaron solo en las capturas. Tampoco cubre las páginas públicas: no usan las paletas, lo que se verifica en una prueba E2E.

## 6. Observación de staging (ajena a esta funcionalidad)

Con sesión real en staging, cuatro consultas de carga de la app devuelven **400 por columnas que faltan en el esquema de staging**:

- `group_expenses.expense_date`
- `profiles.group_tags`
- `fines.created_at`
- `collections.created_at`

`api.js` y `App.jsx` no cambiaron respecto a `f4a1e60`. Significa que **el esquema de `Chamusca-Staging` no está a la par con producción**. No afectó a estas pruebas, pero conviene igualarlo antes de usar staging para validar Cobros, Multas o Tags.

## 7. Datos sintéticos que quedan en staging

- Usuarios `f5qa-appearance-a@f5manager.test` (`ba055e8f-…`) y `f5qa-appearance-b@f5manager.test` (`6e9cdbca-…`)
- Grupo `bd2d7fe4-…` con sus dos membresías
- Partido `24159573-…` con una asistencia

Se pueden reutilizar. Las contraseñas se generaron al azar y solo están en el directorio temporal de la sesión, no en el repositorio. Para borrarlo todo hay que eliminar ambos usuarios, lo que borra en cascada sus perfiles, membresías y asistencias, y después el grupo y el partido.

## 8. Archivos modificados en esta validación

- `frontend/src/appearance/appearance.js`: `reconcileAppearance`, `toRemote` y `userId` local.
- `frontend/src/appearance/AppearanceProvider.jsx`: relectura con `getUser()`, reconciliación por cuenta y sin bucles.
- `frontend/src/components/AppearanceSettings.jsx`: texto que no promete tiempo real.
- `frontend/src/matchday.css`: correcciones de Club Light y tarjetas que siguen la paleta.
- `frontend/src/components/ui/Tabs.jsx`: color de la insignia por token.
- `frontend/src/pages/CourtReservationPage.jsx`: contraste de los botones de WhatsApp.
- `frontend/src/__tests__/matchday.test.jsx`: 3 pruebas nuevas y metadata obsoleta.
- `frontend/scripts/qa-staging/*.cjs`: preparación, validación, reinicio y escáner. Leen las credenciales de un directorio local indicado por `QA_DIR`; no contienen secretos.
- `docs/qa/appearance-staging/*.json`: evidencia.

## 9. Recursos locales

- Servidores Vite temporales (puertos 5173 y 5175) detenidos; ambos puertos libres.
- El worktree temporal de `f4a1e60` se eliminó; `git worktree list` muestra solo el principal.
- Sin `git push` y sin despliegues.
