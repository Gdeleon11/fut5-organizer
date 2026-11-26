/**
 * F5 Manager — Identidad visual por posición (parte de Matchday Lineups V1).
 *
 * Colores semánticos por posición de fútbol 5, independientes de la paleta de
 * apariencia (neon/midnight/gold/light), para que se distingan en los cuatro
 * temas y en los PNG exportados.
 *
 * - POR: amarillo
 * - DEF: azul
 * - MED: verde
 * - DEL: rojo
 * - FLX: violeta
 * - Sin posición / desconocido: neutro (pizarra)
 *
 * Las etiquetas cortas acompañan al color para mantener accesibilidad.
 */
export const POSITION_COLORS = {
  Goalkeeper: "#eab308", // POR — amarillo
  Defender: "#3b82f6",   // DEF — azul
  Midfielder: "#22c55e", // MED — verde
  Forward: "#ef4444",    // DEL — rojo
  Flexible: "#a855f7",   // FLX — violeta
};

export const POSITION_NEUTRAL = "#94a3b8";

export const POSITION_SHORT = {
  Goalkeeper: "POR",
  Defender: "DEF",
  Midfielder: "MED",
  Forward: "DEL",
  Flexible: "FLX",
};

export const POSITION_LABEL = {
  Goalkeeper: "Portero",
  Defender: "Defensa",
  Midfielder: "Medio",
  Forward: "Delantero",
  Flexible: "Flexible",
};

/** Color de borde/ficha por posición. Neutral cuando no hay posición declarada. */
export function positionColor(position) {
  return POSITION_COLORS[position] || POSITION_NEUTRAL;
}

/** Etiqueta corta de posición (POR / DEF / MED / DEL / FLX). */
export function positionShort(position) {
  return POSITION_SHORT[position] || "FLX";
}

/** Etiqueta legible de posición. */
export function positionLabel(position) {
  return POSITION_LABEL[position] || "Flexible";
}

/** Indica si la posición está declarada (no es Flexible/desconocida). */
export function hasDeclaredPosition(position) {
  return Boolean(position && POSITION_COLORS[position] && position !== "Flexible");
}
