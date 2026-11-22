import { useEffect, useState } from "react";
import { CheckCircle2, Lock, Radar as RadarIcon, Search, Send, Settings2, X } from "lucide-react";
import { shortDate } from "../../radar/radarModel.js";

const WELCOME_KEY = "f5_radar_welcome_v1";

function readDismissed() {
  try { return window.localStorage.getItem(WELCOME_KEY) === "1"; } catch { return false; }
}

/** First-visit explainer: find matches with open spots, and how organizers fill theirs. */
export function RadarWelcome() {
  const [hidden, setHidden] = useState(readDismissed);
  if (hidden) return null;
  function dismiss() {
    try { window.localStorage.setItem(WELCOME_KEY, "1"); } catch { /* private mode: hide for this visit */ }
    setHidden(true);
  }
  return (
    <section className="rd-welcome" aria-labelledby="rd-welcome-title" data-radar-welcome>
      <button type="button" className="md-icon-btn rd-welcome-x" aria-label="Cerrar bienvenida" onClick={dismiss}><X size={16} aria-hidden="true" /></button>
      <span className="rd-welcome-icon" aria-hidden="true"><RadarIcon size={22} /></span>
      <h2 id="rd-welcome-title">Bienvenido a Radar</h2>
      <p>Encontrá partidos de otros grupos que buscan jugadores, y completá los cupos de tus propios partidos.</p>
      <ol className="rd-steps">
        <li><Search size={16} aria-hidden="true" /><span><b>Buscá</b> por zona, fecha y nivel.</span></li>
        <li><Send size={16} aria-hidden="true" /><span><b>Pedí un cupo</b> con tu apodo y posición.</span></li>
        <li><CheckCircle2 size={16} aria-hidden="true" /><span><b>El organizador decide.</b> Si te acepta, ves la dirección y el costo.</span></li>
      </ol>
      <p className="rd-privacy"><Lock size={13} aria-hidden="true" /> Tu ubicación no se guarda y tus datos de contacto no se comparten.</p>
      <button type="button" className="md-btn md-btn-ghost" onClick={dismiss}>Entendido</button>
    </section>
  );
}

/**
 * For group admins on the Radar page: the group's Radar status and the next step to publish a
 * match. It never changes settings itself — enabling stays in Grupos → Configuración (with its
 * privacy review), and publishing stays in the match's Radar panel.
 */
export function RadarOrganizerCard({ groupId, groupName, isSuperAdmin, matches = [], radarApi, onPrepareMatch, onOpenSettings }) {
  const [enabled, setEnabled] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!groupId) return undefined;
    radarApi.getRadarGroupSettings(groupId)
      .then((s) => { if (alive) setEnabled(!!s?.enabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, [groupId, radarApi]);

  if (enabled === null) return null;
  const name = groupName || "tu grupo";
  return (
    <section className="rd-organizer" aria-labelledby="rd-org-title" data-radar-organizer={enabled ? "on" : "off"}>
      <div className="rd-organizer-head">
        <h2 id="rd-org-title">Completá cupos de {name}</h2>
        <span className={`md-chip ${enabled ? "tone-ok" : "tone-mute"}`}>{enabled ? "Radar activo" : "Radar apagado"}</span>
      </div>
      {!enabled ? (
        <>
          <p>Radar está apagado para este grupo, así que ningún partido aparece fuera de él.</p>
          {isSuperAdmin ? (
            <button type="button" className="md-btn md-btn-accent" onClick={onOpenSettings}>
              <Settings2 size={15} aria-hidden="true" /> Revisar privacidad y activar
            </button>
          ) : (
            <p className="rd-privacy">Solo el super admin del grupo puede activarlo en Grupos → Configuración.</p>
          )}
        </>
      ) : matches.length === 0 ? (
        <p>No hay partidos próximos con cupos libres para publicar.</p>
      ) : (
        <>
          <p>Elegí un partido para preparar su publicación. Nada se publica hasta que confirmes en el partido.</p>
          <ul className="rd-org-list">
            {matches.slice(0, 3).map((m) => (
              <li key={m.id}>
                <span><b>{m.title || "Partido"}</b><small>{shortDate(m.match_date, m.start_time)}{m.free != null ? ` · ${m.free} ${m.free === 1 ? "cupo libre" : "cupos libres"}` : ""}</small></span>
                <button type="button" className="md-btn md-btn-ghost" onClick={() => onPrepareMatch(m.id)}>Preparar publicación</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
