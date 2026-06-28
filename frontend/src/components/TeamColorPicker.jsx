const TEAM_COLORS = [
  { name: "Rojo", hex: "#ef4444" },
  { name: "Azul", hex: "#3b82f6" },
  { name: "Verde", hex: "#22c55e" },
  { name: "Amarillo", hex: "#eab308" },
  { name: "Naranja", hex: "#f97316" },
  { name: "Morado", hex: "#a855f7" },
  { name: "Negro", hex: "#1f2937" },
  { name: "Blanco", hex: "#ffffff" },
];

export default function TeamColorPicker({ currentColor, onColorChange, compact = false }) {
  return (
    <div className={`team-color-picker ${compact ? "compact" : ""}`}>
      {TEAM_COLORS.map((color) => (
        <button
          key={color.hex}
          type="button"
          className={`color-swatch ${currentColor === color.hex ? "is-selected" : ""}`}
          style={{ background: color.hex, border: color.hex === "#ffffff" ? "2px solid #d1d5db" : "2px solid transparent" }}
          onClick={() => onColorChange(color.hex)}
          title={color.name}
          aria-label={`Color ${color.name}`}
        />
      ))}
    </div>
  );
}

export { TEAM_COLORS };
