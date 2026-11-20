# Manual production check: Entregas 2 and 3

**Production:** https://f5manager.lat (master `e158568`)
**Time needed:** about 15 minutes with an admin account and about 5 minutes with a player account.

## Rule: read only

- Do not press anything that saves.
- Close any form or modal with **Cancelar** or **Esc**.

**Do not press these buttons:**

| Area | Buttons |
| --- | --- |
| Payments | Marcar pagado / ✓, Perdonar / ✕, Aprobar / Rechazar comprobante |
| Fines | Marcar pagada |
| Expenses | Guardar egreso, Borrar |
| Collections | Cerrar colaboración |
| Reservations | Confirmar y crear partido, Subir comprobante |
| Players | Activar / Desactivar jugador |
| Other forms | Guardar perfil, Crear … |

## 0. Preparation

1. Sign in with your admin account in a normal browser window.
2. Open **Apariencia** in the sidebar or the profile menu. You will change the design and palette there in each step.

## 1. Jugadores (Entrega 2), with admin

| # | Steps | Expected result |
| --- | --- | --- |
| 1.1 | Jugadores → Directorio. Search for a name, then filter by Activos, Inactivos and Todos. | The counts match the group, and there is no sideways scrolling. |
| 1.2 | Open a player. | The FIFA card shows once and the stats show once. Private data (phone, fines) is visible because you are an admin. |
| 1.3 | Check Evolución. | It only appears when the player has at least 3 matches with stats. |
| 1.4 | Ranking tab. | The podium and the table match the goals you know about. |
| 1.5 | Mi FIFA. | The card, attributes, history and the edit form show. **Do not save.** |

## 2. Cobros (Entrega 3), with admin

| # | Steps | Expected result |
| --- | --- | --- |
| 2.1 | Cobros → Caja y finanzas. | Income, expenses and balance match what you know. A negative balance shows a minus sign (−). |
| 2.2 | Filter Ingresos and then Egresos in the ledger. | Only that kind of movement is listed. |
| 2.3 | Cobros y cuotas. | Each match shows paid/total and how much was collected. Payments with a proof waiting show **Revisar**. |
| 2.4 | Open **Revisar** on any pending proof. | The image, the player and the amount show. **Close with Esc** without approving. |
| 2.5 | Multas, then switch the date filter. | The totals change with the date range. |

## 3. Reservas (Entrega 3), with admin

| # | Steps | Expected result |
| --- | --- | --- |
| 3.1 | Reservas → Calendario. Move to the previous and next month. | Reservations appear on their day, and clicking a day shows its cards. |
| 3.2 | Tarjetas and Lista views. | Pending reservations without a proof have **Confirmar** disabled. |
| 3.3 | Sedes y canchas. | Venues show cost, uses, total and last use. |

## 4. Designs and palettes

1. Repeat 1.1, 2.1 and 3.1 in **Matchday Editorial** and in **Sports Command Center**.
2. In each design, switch between the four palettes: Neon, Midnight, Gold and Light.
3. Check that the text stays readable and that status colours (pending, paid, rejected) can be told apart.

## 5. Mobile (phone or a narrow window)

| # | Steps | Expected result |
| --- | --- | --- |
| 5.1 | Jugadores, Cobros and Reservas. | No sideways scrolling and all tabs are visible. The bottom bar does not cover any button. |
| 5.2 | Calendar on mobile. | The days show coloured dots, and tapping a day shows its detail. |

## 6. Player account (no admin role)

| # | Steps | Expected result |
| --- | --- | --- |
| 6.1 | Jugadores → open another player. | Phone, fines, tags and admin actions are hidden. |
| 6.2 | Cobros → Cobros y cuotas. | Only your own debts show, with **Link** to upload a proof. There is no ✓ or ✕. |
| 6.3 | Multas. | Only your own fines show, with no **Marcar pagada**. |
| 6.4 | Caja y finanzas. | The **Registrar egreso** form does not appear. |
| 6.5 | Reservas. | If you are responsible for a reservation, you see **Subir comprobante** and no **Eliminar**. |

## What to report

For anything that fails, send:

- the step number;
- the design and palette;
- desktop or mobile;
- a screenshot, with phone numbers and personal data hidden.
