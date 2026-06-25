import { useState, useEffect } from "react";

const THEMES = [
  { id: "field", label: "Campo", emoji: "⚽" },
  { id: "light", label: "Claro", emoji: "☀️" },
  { id: "night", label: "Noche", emoji: "🌙" },
];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "field";
    return localStorage.getItem("fut5_theme") || "field";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fut5_theme", theme);
  }, [theme]);

  function cycle() {
    const idx = THEMES.findIndex((t) => t.id === theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next.id);
  }

  const current = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <button
      className="ghost-button theme-switcher"
      type="button"
      onClick={cycle}
      title={`Tema: ${current.label}`}
    >
      <span aria-hidden="true">{current.emoji}</span>
      <span className="sr-only">Cambiar tema: {current.label}</span>
    </button>
  );
}
