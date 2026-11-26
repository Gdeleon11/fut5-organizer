/**
 * Canvas color tokens aligned with F5 Manager's 4 Premium palettes and 2 experiences.
 * Keeps exported PNGs faithful to the user's chosen appearance without external CSS dependencies.
 */

export const SHARE_PALETTES = {
  neon: {
    id: "neon",
    isDark: true,
    bg: "#0b0f0c",
    bgGrad: "#112217",
    surface: "#121a15",
    surfaceAlt: "#19261e",
    border: "rgba(91, 229, 132, 0.28)",
    borderSoft: "rgba(242, 244, 243, 0.12)",
    accent: "#5be584",
    accentSoft: "rgba(91, 229, 132, 0.16)",
    accentInk: "#07180c",
    ink: "#f2f4f3",
    muted: "#9eb2a5",
    subtle: "#6e8275",
    gold: "#f5c842",
  },
  midnight: {
    id: "midnight",
    isDark: true,
    bg: "#0b1020",
    bgGrad: "#13203d",
    surface: "#121a30",
    surfaceAlt: "#192442",
    border: "rgba(108, 180, 255, 0.30)",
    borderSoft: "rgba(238, 243, 255, 0.12)",
    accent: "#6cb4ff",
    accentSoft: "rgba(108, 180, 255, 0.16)",
    accentInk: "#071324",
    ink: "#eef3ff",
    muted: "#9eb0d0",
    subtle: "#6b7ea0",
    gold: "#f5c842",
  },
  gold: {
    id: "gold",
    isDark: true,
    bg: "#0f0d0a",
    bgGrad: "#241d12",
    surface: "#18140f",
    surfaceAlt: "#221c14",
    border: "rgba(231, 191, 95, 0.32)",
    borderSoft: "rgba(246, 241, 230, 0.12)",
    accent: "#e7bf5f",
    accentSoft: "rgba(231, 191, 95, 0.16)",
    accentInk: "#171207",
    ink: "#f6f1e6",
    muted: "#bfb5a2",
    subtle: "#8a806f",
    gold: "#e7bf5f",
  },
  light: {
    id: "light",
    isDark: false,
    bg: "#f4f6f3",
    bgGrad: "#e7efe8",
    surface: "#ffffff",
    surfaceAlt: "#eef3ee",
    border: "rgba(10, 102, 51, 0.24)",
    borderSoft: "rgba(17, 26, 20, 0.12)",
    accent: "#0a6633",
    accentSoft: "rgba(10, 102, 51, 0.12)",
    accentInk: "#ffffff",
    ink: "#111a14",
    muted: "#4a5d51",
    subtle: "#6d7f74",
    gold: "#b8860b",
  },
};

export function resolveShareTheme(palette = "neon", design = "editorial") {
  const base = SHARE_PALETTES[palette] || SHARE_PALETTES.neon;
  return {
    ...base,
    design: design === "command" ? "command" : "editorial",
  };
}
