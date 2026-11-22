import { useCallback, useEffect, useState } from "react";
import { Radar as RadarIcon } from "lucide-react";
import { api as defaultApi } from "../../api.js";

/** Grupos → Configuración (super admin): the group's Radar switch and its ban list. */
export default function RadarSettingsCard({ groupId, radarApi = defaultApi }) {
  const [settings, setSettings] = useState(null);
  const [bans, setBans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Turning Radar on goes through a privacy review; turning it off is immediate.
  const [reviewing, setReviewing] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const load = useCallback(async () => {
    try {
      setSettings(await radarApi.getRadarGroupSettings(groupId));
      setBans(await radarApi.radarGroupBans(groupId));
    } catch (e) { setError(e.message); }
  }, [radarApi, groupId]);
  useEffect(() => { if (groupId) load(); }, [groupId, load]);

  async function save(next) {
    setBusy(true); setError(""); setMessage("");
    try {
      const row = await radarApi.setRadarGroupSettings(groupId, next.enabled, next.show_group_name);
      setSettings(row);
      setReviewing(false); setUnderstood(false);
      setMessage(next.enabled ? "Radar activado. Los admins ya pueden publicar partidos." : "Radar desactivado. Se cerraron las publicaciones abiertas.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function unban(profileId) {
    setBusy(true); setError("");
    try { await radarApi.radarUnban(groupId, profileId); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="fx-section rd-settings" aria-label="Radar" id="radar-settings">
      <div className="mdd-head fx-head"><h2><RadarIcon size={17} aria-hidden="true" /> Radar</h2></div>
      {error && <p className="form-message" role="alert">{error}</p>}
      {message && <p className="rd-ok" role="status">{message}</p>}
      {!settings ? <p className="fx-empty" role="status">Cargando…</p> : (
        <div className="md-form rd-settings-form">
          <label className="rd-switch">
            <input type="checkbox" checked={!!settings.enabled || reviewing} disabled={busy}
              onChange={(e) => {
                if (e.target.checked) { setReviewing(true); setUnderstood(false); setMessage(""); }
                else if (reviewing) setReviewing(false);
                else save({ ...settings, enabled: false });
              }} />
            <span><b>Permitir publicar partidos en Radar</b><small>Cada partido sigue privado hasta que un admin lo publica. Desactivar cierra las publicaciones abiertas.</small></span>
          </label>
          {reviewing && !settings.enabled && (
            <div className="rd-review" role="group" aria-labelledby="rd-review-title">
              <h3 id="rd-review-title">Antes de activar Radar</h3>
              <div className="rd-review-cols">
                <div>
                  <b>Al publicar un partido, otros jugadores de F5 ven</b>
                  <ul>
                    <li>Fecha, hora, cancha y zona aproximada</li>
                    <li>Distancia aproximada (nunca coordenadas)</li>
                    <li>Cupos para Radar, nivel, posiciones y una nota opcional</li>
                    <li>Costo estimado por jugador</li>
                    <li>“Grupo privado”, salvo que actives mostrar el nombre</li>
                  </ul>
                </div>
                <div>
                  <b>Nunca se muestra</b>
                  <ul>
                    <li>La lista del grupo, nombres, teléfonos ni fotos</li>
                    <li>El nombre del partido ni el enlace de invitados</li>
                    <li>La dirección exacta, salvo a jugadores que aceptes</li>
                    <li>La ubicación de quien busca partido</li>
                  </ul>
                </div>
              </div>
              <p className="rd-privacy">Activar no publica nada: cada partido sigue privado hasta que un admin lo publique, y cada solicitud necesita tu aprobación. Podés bloquear jugadores y apagar Radar cuando quieras (se cierran las publicaciones abiertas).</p>
              <label className="rd-check">
                <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                <span>Revisé qué se comparte y quiero permitir publicaciones en Radar para este grupo.</span>
              </label>
              <div className="rd-review-actions">
                <button type="button" className="md-btn md-btn-accent" disabled={!understood || busy} onClick={() => save({ ...settings, enabled: true })}>Activar Radar</button>
                <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={() => setReviewing(false)}>Cancelar</button>
              </div>
            </div>
          )}
          <label className="rd-switch">
            <input type="checkbox" checked={!!settings.show_group_name} disabled={busy || !settings.enabled}
              onChange={(e) => save({ ...settings, show_group_name: e.target.checked })} />
            <span><b>Mostrar el nombre del grupo</b><small>Si está apagado, los partidos aparecen como “Grupo privado”.</small></span>
          </label>
          {bans.length > 0 && (
            <div className="rd-bans">
              <h3>Bloqueados en Radar</h3>
              <ul>
                {bans.map((b) => (
                  <li key={b.profile_id}><span>{b.nickname}</span>
                    <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={() => unban(b.profile_id)}>Desbloquear</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
