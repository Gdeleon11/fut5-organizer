// -----------------------------------------------------------------------------
// Almacén PROVISIONAL de capacidades manuales (1-100) por jugador.
//
// Guarda en localStorage, NO en Supabase. Es para pruebas: permite puntear las
// 6 capacidades (ritmo, tiro, pase, regate, defensa, físico) sin tocar la base
// de datos. Todo es tolerante a fallos (SSR / modo privado / storage lleno).
// -----------------------------------------------------------------------------

const STORAGE_KEY = "f5_capacities_v1";

export const CAPACITY_KEYS = [
  { key: "pace", label: "Ritmo", stat: "pac" },
  { key: "shooting", label: "Tiro", stat: "sho" },
  { key: "passing", label: "Pase", stat: "pas" },
  { key: "dribbling", label: "Regate", stat: "dri" },
  { key: "defending", label: "Defensa", stat: "def" },
  { key: "physical", label: "Físico", stat: "phy" },
];

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readAll() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? safeParse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Notifica a la app para re-renderizar donde escuche este evento.
    window.dispatchEvent(new CustomEvent("f5-capacities-changed"));
  } catch {
    /* almacenamiento no disponible: se ignora silenciosamente */
  }
}

const clamp = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.max(1, Math.min(100, v));
};

// Devuelve el objeto de capacidades de un jugador, o null si no hay ninguna.
export function getCapacities(profileId) {
  if (!profileId) return null;
  const all = readAll();
  const entry = all[profileId];
  if (!entry) return null;
  const out = {};
  let has = false;
  for (const { key } of CAPACITY_KEYS) {
    const v = clamp(entry[key]);
    if (v != null) {
      out[key] = v;
      has = true;
    }
  }
  return has ? out : null;
}

// Guarda (fusiona) las capacidades de un jugador. Valores vacíos se eliminan.
export function saveCapacities(profileId, caps) {
  if (!profileId) return;
  const all = readAll();
  const current = { ...(all[profileId] || {}) };
  for (const { key } of CAPACITY_KEYS) {
    if (key in caps) {
      const v = clamp(caps[key]);
      if (v == null) delete current[key];
      else current[key] = v;
    }
  }
  if (Object.keys(current).length === 0) delete all[profileId];
  else all[profileId] = current;
  writeAll(all);
}

// Convierte capacidades (claves pace/shooting/...) a stats FIFA (pac/sho/...).
export function capsToStats(caps) {
  if (!caps) return null;
  const out = {};
  let has = false;
  for (const { key, stat } of CAPACITY_KEYS) {
    if (caps[key] != null) {
      out[stat] = caps[key];
      has = true;
    }
  }
  return has ? out : null;
}
