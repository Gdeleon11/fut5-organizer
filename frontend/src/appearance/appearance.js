/**
 * F5 Matchday — appearance preferences (design + palette).
 *
 * Pure helpers: validation, local persistence, legacy migration and DOM application.
 * Remote (cross-device) sync lives in AppearanceProvider and uses the signed-in
 * user's own Supabase Auth metadata, so no table, migration or RLS change is needed.
 */

export const DESIGNS = [
  {
    id: "editorial",
    label: "Matchday Editorial",
    description: "Tipografía protagonista, agenda e historial editorial, pocos contenedores.",
  },
  {
    id: "command",
    label: "Sports Command Center",
    description: "Cancha táctica con fichas, anillo de quórum y marcador deportivo.",
  },
];

export const PALETTES = [
  { id: "neon", label: "F5 Neon", scheme: "dark", swatch: ["#0d0f0e", "#5be584", "#f2f4f3"] },
  { id: "midnight", label: "Midnight Blue", scheme: "dark", swatch: ["#0b1020", "#6cb4ff", "#eef3ff"] },
  { id: "gold", label: "Elite Gold", scheme: "dark", swatch: ["#0f0d0a", "#e7bf5f", "#f6f1e6"] },
  { id: "light", label: "Club Light", scheme: "light", swatch: ["#f5f7f4", "#0f7a3d", "#121a15"] },
];

export const DEFAULT_APPEARANCE = Object.freeze({ design: "editorial", palette: "neon", updatedAt: 0 });

export const STORAGE_KEY = "f5_appearance_v1";
export const METADATA_KEY = "f5_appearance";
export const LEGACY_THEME_KEY = "fut5_theme";

/** Old ThemeSwitcher ids → new palettes, so existing users keep a close match. */
export const LEGACY_THEME_MAP = {
  field: "neon",
  neon: "neon",
  night: "midnight",
  retro: "gold",
  light: "light",
};

const DESIGN_IDS = new Set(DESIGNS.map((d) => d.id));
const PALETTE_IDS = new Set(PALETTES.map((p) => p.id));

export function isDesign(value) {
  return DESIGN_IDS.has(value);
}

export function isPalette(value) {
  return PALETTE_IDS.has(value);
}

/** Returns a fully valid appearance object; unknown values fall back to defaults. */
export function normalizeAppearance(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_APPEARANCE };
  const updatedAt = Number(raw.updatedAt);
  return {
    design: isDesign(raw.design) ? raw.design : DEFAULT_APPEARANCE.design,
    palette: isPalette(raw.palette) ? raw.palette : DEFAULT_APPEARANCE.palette,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
  };
}

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readLocalAppearance(storage) {
  const store = safeStorage(storage);
  if (!store) return { ...DEFAULT_APPEARANCE };
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw) return normalizeAppearance(JSON.parse(raw));
    const legacy = store.getItem(LEGACY_THEME_KEY);
    if (legacy && LEGACY_THEME_MAP[legacy]) {
      return { ...DEFAULT_APPEARANCE, palette: LEGACY_THEME_MAP[legacy] };
    }
  } catch {
    /* corrupted value or blocked storage: fall through to defaults */
  }
  return { ...DEFAULT_APPEARANCE };
}

export function writeLocalAppearance(value, storage) {
  const store = safeStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(normalizeAppearance(value)));
    return true;
  } catch {
    return false;
  }
}

/** Newest wins; ties keep the local value (avoids needless re-renders). */
export function pickNewest(local, remote) {
  const l = normalizeAppearance(local);
  if (!remote) return l;
  const r = normalizeAppearance(remote);
  return r.updatedAt > l.updatedAt ? r : l;
}

export function sameAppearance(a, b) {
  return Boolean(a && b && a.design === b.design && a.palette === b.palette);
}

export function paletteScheme(paletteId) {
  return PALETTES.find((p) => p.id === paletteId)?.scheme || "dark";
}

/** Applies design/palette to the document root. Returns a cleanup function. */
export function applyAppearance(value, root) {
  const el = root || (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return () => {};
  const v = normalizeAppearance(value);
  el.setAttribute("data-f5-design", v.design);
  el.setAttribute("data-f5-palette", v.palette);
  el.style.colorScheme = paletteScheme(v.palette);
  // The legacy ThemeSwitcher wrote data-theme; palettes now own every token.
  el.removeAttribute("data-theme");
  return () => {
    el.removeAttribute("data-f5-design");
    el.removeAttribute("data-f5-palette");
    el.style.colorScheme = "";
  };
}
