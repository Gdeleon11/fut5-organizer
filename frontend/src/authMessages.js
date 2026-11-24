/* Supabase Auth returns English messages; users only ever see these Spanish versions. */
const RULES = [
  [/invalid login credentials/i, "Email o contraseña incorrectos."],
  [/email not confirmed/i, "Tu email no está confirmado. Revisá tu correo o reenviá la confirmación."],
  [/user already registered|already been registered/i, "Ya existe una cuenta con este email. Probá entrar o recuperar tu contraseña."],
  [/rate limit|too many requests|for security purposes, you can only request/i, "Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo."],
  [/email address .* is invalid|invalid email|unable to validate email/i, "Ese email no parece válido. Revisalo e intentá de nuevo."],
  [/password should be at least|password is too short/i, "La contraseña debe tener al menos 6 caracteres."],
  [/new password should be different/i, "La nueva contraseña tiene que ser distinta de la anterior."],
  [/weak password|password is known to be weak/i, "Esa contraseña es muy fácil de adivinar. Elegí otra."],
  [/signups? not allowed|signup is disabled/i, "Por ahora no se pueden crear cuentas nuevas."],
  [/auth session missing|session.*expired|refresh token/i, "Tu sesión venció. Volvé a entrar."],
  [/failed to fetch|network|load failed/i, "No pudimos conectarnos. Revisá tu internet y probá de nuevo."],
];

export function authErrorMessage(error) {
  const raw = String(error?.message || error || "").trim();
  if (!raw) return "Algo salió mal. Probá de nuevo.";
  const hit = RULES.find(([re]) => re.test(raw));
  if (hit) return hit[1];
  // Unknown English text from the auth provider: do not show it raw.
  return /^[\x00-\x7F]+$/.test(raw) ? "No pudimos completar el acceso. Probá de nuevo en un momento." : raw;
}

/** ?group=<id> from the current URL (invitation links), or null. */
export function invitedGroupId() {
  if (typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get("group");
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
