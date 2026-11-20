/*
 * F5 Premium — Entrega 4: read-only description of what each role can do today.
 * This is documentation for the UI, NOT an authorization source: the real checks
 * stay in App.jsx / pages (isAdmin, isSuperAdmin) and in Supabase RLS.
 * Keep in sync with the code when permissions change.
 */
export const ROLE_ORDER = ["player", "admin", "super_admin"];

export const ROLE_INFO = {
  player: { label: "Jugador", summary: "Juega, confirma asistencia y gestiona lo suyo." },
  admin: { label: "Admin", summary: "Organiza partidos, cobros, multas, reservas y el plantel." },
  super_admin: { label: "Super Admin", summary: "Todo lo del admin más torneos, calificaciones y ajustes finos." },
};

/** [area, capability, minimum role]. Ordered for display. */
export const CAPABILITIES = [
  ["Partidos", "Ver partidos y confirmar o cancelar mi asistencia", "player"],
  ["Partidos", "Crear y editar partidos, generar equipos y registrar estadísticas", "admin"],
  ["Jugadores", "Ver el plantel, el ranking y perfiles deportivos", "player"],
  ["Jugadores", "Ver datos privados, activar o desactivar jugadores y cambiar posición", "admin"],
  ["Jugadores", "Calificar con estrellas, etiquetas (tags) y capacidades", "super_admin"],
  ["Cobros", "Ver la caja del grupo y mis cuotas, colaboraciones y multas", "player"],
  ["Cobros", "Subir mi comprobante de pago", "player"],
  ["Cobros", "Marcar pagos, perdonar, revisar comprobantes, crear colaboraciones y multas, registrar egresos", "admin"],
  ["Reservas", "Crear delegaciones de cancha y subir comprobante de las asignadas a mí", "player"],
  ["Reservas", "Gestionar reservas asistidas de todo el grupo y editar sedes", "admin"],
  ["Reservas", "Eliminar reservas pendientes", "super_admin"],
  ["Grupo", "Cambiar de grupo y crear una chamusca nueva", "player"],
  ["Grupo", "Editar la descripción y compartir la invitación", "admin"],
  ["Grupo", "Nombrar administradores (Mi FIFA → Roles)", "admin"],
  ["Torneos", "Crear torneos, equipos, calendario y cargar resultados", "super_admin"],
];

export function roleRank(role) {
  const i = ROLE_ORDER.indexOf(role);
  return i < 0 ? 0 : i;
}

export function canRole(role, minRole) {
  return roleRank(role) >= roleRank(minRole);
}
