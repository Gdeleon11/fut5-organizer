import { useEffect, useState } from "react";

/* Startup screens for a signed-in user. Each loading phase says what is happening; after
 * SLOW_MS it offers a retry so a slow or failed request never hides behind a permanent spinner. */
const SLOW_MS = 12000;

const PHASES = {
  session: { title: "Revisando tu sesión", message: "Un momento…", step: 0 },
  redirect: { title: "Abriendo tu panel", message: "Te llevamos a tus partidos…", step: 0 },
  profile: { title: "Preparando tu perfil", message: "Cargando tus datos de jugador…", step: 1 },
  groups: { title: "Buscando tus grupos", message: "Revisando a qué grupos pertenecés…", step: 2 },
  data: { title: "Cargando partidos", message: "Trayendo partidos, asistencias y cobros del grupo…", step: 3 },
};
const STEPS = ["Sesión", "Perfil", "Grupos", "Partidos"];

export default function StartupState({ phase, message, onRetry, onSignOut }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (phase === "error") return undefined;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "error") {
    return (
      <div className="app auth-shell" data-startup="error">
        <section className="panel auth-panel su-panel" role="alert">
          <p className="eyebrow">F5 Manager</p>
          <h1>No pudimos cargar tu panel</h1>
          <p className="muted">{message || "Hubo un problema de conexión."} Tus datos no se modificaron.</p>
          <div className="su-actions">
            {onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}
            {onSignOut && <button type="button" className="ghost-button" onClick={onSignOut}>Cerrar sesión</button>}
          </div>
        </section>
      </div>
    );
  }

  const info = PHASES[phase] || PHASES.session;
  return (
    <div className="app auth-shell" data-startup={phase}>
      <section className="panel auth-panel su-panel" role="status" aria-live="polite" aria-busy="true">
        <p className="eyebrow">F5 Manager</p>
        <div className="su-spinner" aria-hidden="true" />
        <h1>{info.title}</h1>
        <p className="muted">{info.message}</p>
        <ol className="su-steps" aria-label="Progreso de carga">
          {STEPS.map((label, i) => (
            <li key={label} className={i < info.step ? "is-done" : i === info.step ? "is-current" : ""}>{label}</li>
          ))}
        </ol>
        {slow && (
          <div className="su-slow">
            <p className="muted">Está tardando más de lo normal. Revisá tu conexión.</p>
            <button type="button" className="ghost-button" onClick={() => (onRetry ? onRetry() : window.location.reload())}>Reintentar</button>
          </div>
        )}
      </section>
    </div>
  );
}
