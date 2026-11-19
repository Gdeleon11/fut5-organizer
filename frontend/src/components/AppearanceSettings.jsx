import React from "react";
import { Check } from "lucide-react";
import { DESIGNS, PALETTES } from "../appearance/appearance.js";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";

const SYNC_LABEL = {
  local: "Guardado en este dispositivo.",
  saving: "Guardando en tu cuenta…",
  synced: "Guardado en tu cuenta. Tus otros dispositivos lo cargan al abrir o actualizar la app.",
  error: "Guardado en este dispositivo. No se pudo sincronizar con tu cuenta; se reintentará en el próximo cambio.",
};

/** Mini, data-free wireframes that show each layout's composition in the chosen palette. */
function DesignThumb({ design, palette }) {
  return (
    <span className={`md-thumb md-thumb-${design}`} data-f5-palette={palette} aria-hidden="true">
      {design === "editorial" ? (
        <>
          <span className="t-side" />
          <span className="t-main">
            <span className="t-hero">
              <span className="t-day">19</span>
              <span className="t-lines">
                <i />
                <i />
                <span className="t-dots">
                  {Array.from({ length: 8 }, (_, i) => (
                    <b key={i} className={i < 5 ? "on" : ""} />
                  ))}
                </span>
              </span>
              <span className="t-cta" />
            </span>
            <span className="t-cols">
              <i />
              <i />
            </span>
          </span>
        </>
      ) : (
        <>
          <span className="t-rail" />
          <span className="t-main">
            <span className="t-arena">
              <span className="t-pitch">
                {Array.from({ length: 9 }, (_, i) => (
                  <b key={i} className={i < 6 ? "on" : ""} />
                ))}
              </span>
              <span className="t-score">
                <span className="t-clock">19:00</span>
                <span className="t-ring" />
                <span className="t-cta" />
              </span>
            </span>
            <span className="t-cols">
              <i />
              <i />
            </span>
          </span>
        </>
      )}
    </span>
  );
}

/**
 * Apariencia — design + palette picker. Changes apply instantly (no reload, no sign-out)
 * and persist immediately; signed-in users also get them on their other devices.
 */
export default function AppearanceSettings() {
  const { design, palette, setDesign, setPalette, syncStatus } = useAppearance();

  return (
    <section className="panel md-appearance" id="apariencia" aria-labelledby="md-appearance-title">
      <div className="md-appearance-head">
        <p className="eyebrow">Preferencias</p>
        <h2 id="md-appearance-title">Apariencia</h2>
        <p className="md-appearance-help">
          Elige cómo se ve F5 Manager. El cambio se aplica al instante y se guarda automáticamente.
        </p>
      </div>

      <fieldset className="md-choice-group">
        <legend>Diseño</legend>
        <div className="md-design-grid">
          {DESIGNS.map((d) => (
            <label key={d.id} className={`md-design-opt${design === d.id ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="f5-design"
                value={d.id}
                checked={design === d.id}
                onChange={() => setDesign(d.id)}
              />
              <DesignThumb design={d.id} palette={palette} />
              <span className="md-opt-text">
                <b>
                  {d.label}
                  {design === d.id && <Check size={16} aria-hidden="true" />}
                </b>
                <small>{d.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="md-choice-group">
        <legend>Paleta</legend>
        <div className="md-palette-grid">
          {PALETTES.map((p) => (
            <label key={p.id} className={`md-palette-opt${palette === p.id ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="f5-palette"
                value={p.id}
                checked={palette === p.id}
                onChange={() => setPalette(p.id)}
              />
              <span className="md-swatch" aria-hidden="true">
                {p.swatch.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="md-opt-text">
                <b>
                  {p.label}
                  {palette === p.id && <Check size={16} aria-hidden="true" />}
                </b>
                <small>{p.scheme === "light" ? "Tema claro" : "Tema oscuro"}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="md-sync" role="status" aria-live="polite">
        {SYNC_LABEL[syncStatus] || SYNC_LABEL.local}
      </p>
    </section>
  );
}
