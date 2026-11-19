import React from "react";
import { Check } from "lucide-react";
import { DESIGNS, PALETTES } from "../appearance/appearance.js";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import DesignPreview from "./DesignPreview.jsx";

const SYNC_LABEL = {
  local: "Guardado en este dispositivo.",
  saving: "Guardando en tu cuenta…",
  synced: "Guardado en tu cuenta. Tus otros dispositivos lo cargan al abrir o actualizar la app.",
  error: "Guardado en este dispositivo. No se pudo sincronizar con tu cuenta; se reintentará en el próximo cambio.",
};

/**
 * Apariencia — design + palette picker. Changes apply instantly (no reload, no sign-out)
 * and persist immediately; signed-in users also get them on their other devices.
 */
export default function AppearanceSettings({ asPage = false }) {
  const { design, palette, setDesign, setPalette, syncStatus } = useAppearance();
  const activeDesign = DESIGNS.find((d) => d.id === design);
  const activePalette = PALETTES.find((p) => p.id === palette);
  const Heading = asPage ? "h1" : "h2";

  return (
    <section className="panel md-appearance" id="apariencia" aria-labelledby="md-appearance-title">
      <div className="md-appearance-head">
        <p className="eyebrow">Preferencias</p>
        <Heading id="md-appearance-title">Apariencia</Heading>
        <p className="md-appearance-help">
          Elige el diseño de Partidos y la paleta de colores. El cambio se aplica al instante y se guarda
          automáticamente.
        </p>
        <p className="md-appearance-current" role="status" aria-live="polite">
          Activo ahora: <b>{activeDesign?.label}</b> · <b>{activePalette?.label}</b>
        </p>
      </div>

      <fieldset className="md-choice-group">
        <legend>Diseño de Partidos</legend>
        <p className="md-choice-note">Vista previa real del diseño con datos de ejemplo, en tu paleta actual.</p>
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
              <DesignPreview design={d.id} />
              <span className="md-opt-text">
                <b>
                  {d.label}
                  {design === d.id && (
                    <span className="md-active-chip">
                      <Check size={14} aria-hidden="true" /> Activo
                    </span>
                  )}
                </b>
                <small>{d.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="md-choice-group">
        <legend>Paleta de colores</legend>
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
                  {palette === p.id && (
                    <span className="md-active-chip">
                      <Check size={14} aria-hidden="true" /> Activa
                    </span>
                  )}
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
