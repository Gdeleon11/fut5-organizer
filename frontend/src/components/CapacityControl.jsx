import { useState, useEffect } from "react";
import { CAPACITY_KEYS, getCapacities, saveCapacities } from "../capacityStore.js";

// Editor provisional de capacidades 1-100 por jugador (localStorage, sin Supabase).
export default function CapacityControl({ profileId }) {
  const [values, setValues] = useState({});
  const [savedTick, setSavedTick] = useState(false);

  // Cargar valores actuales cuando cambia el jugador seleccionado.
  useEffect(() => {
    const caps = getCapacities(profileId) || {};
    const init = {};
    for (const { key } of CAPACITY_KEYS) init[key] = caps[key] ?? "";
    setValues(init);
  }, [profileId]);

  const handleChange = (key, raw) => {
    // Permite vacío o número 1-100
    if (raw === "") {
      setValues((v) => ({ ...v, [key]: "" }));
      return;
    }
    let n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    n = Math.max(1, Math.min(100, n));
    setValues((v) => ({ ...v, [key]: n }));
  };

  const handleSave = () => {
    const toSave = {};
    for (const { key } of CAPACITY_KEYS) {
      toSave[key] = values[key] === "" ? null : values[key];
    }
    saveCapacities(profileId, toSave);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1600);
  };

  const handleClear = () => {
    const cleared = {};
    for (const { key } of CAPACITY_KEYS) cleared[key] = null;
    saveCapacities(profileId, cleared);
    const empty = {};
    for (const { key } of CAPACITY_KEYS) empty[key] = "";
    setValues(empty);
  };

  return (
    <div className="capacity-control">
      <div className="capacity-grid">
        {CAPACITY_KEYS.map(({ key, label }) => {
          const val = values[key] === "" || values[key] == null ? 0 : values[key];
          return (
            <div className="capacity-item" key={key}>
              <div className="capacity-item-head">
                <span className="capacity-item-label">{label}</span>
                <input
                  className="capacity-number"
                  type="number"
                  min="1"
                  max="100"
                  inputMode="numeric"
                  placeholder="—"
                  value={values[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
              </div>
              <input
                className="capacity-slider"
                type="range"
                min="0"
                max="100"
                value={val}
                onChange={(e) => handleChange(key, e.target.value)}
                style={{ "--cap-fill": `${val}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="capacity-actions">
        <button type="button" className="capacity-save-btn" onClick={handleSave}>
          {savedTick ? "✓ Guardado" : "Guardar capacidades"}
        </button>
        <button type="button" className="capacity-clear-btn" onClick={handleClear}>
          Limpiar
        </button>
      </div>
      <p className="capacity-hint">
        Provisional (solo en este dispositivo). Si dejas una capacidad vacía, se
        calcula automáticamente desde las estrellas.
      </p>
    </div>
  );
}
