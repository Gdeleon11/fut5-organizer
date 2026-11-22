import { useEffect, useMemo, useState } from "react";
import { Award, BadgeCheck, Minus, PencilLine, Plus, Sparkles } from "lucide-react";
import { api as defaultApi } from "../../api.js";
import {
  POSITIONS, STYLE_KEYS, STYLE_POINTS, achievements, adjustPoint, positionLabel, starterStyle, usedPoints, validateStyle, verifiedRecord,
} from "../../players/playerStyle.js";

export function StyleBars({ style }) {
  return (
    <ul className="pb-bars" aria-label="Estilo autodeclarado">
      {STYLE_KEYS.map(({ key, label }) => (
        <li key={key}>
          <span>{label}</span>
          <span className="pb-bar" aria-hidden="true"><i style={{ inlineSize: `${(Number(style?.[key]) || 0) * 10}%` }} /></span>
          <b>{Number(style?.[key]) || 0}</b>
        </li>
      ))}
    </ul>
  );
}

/** Optional builder: main/secondary position + 10 points. Self-declared, clearly labelled as such. */
export function PlayerBuilder({ profile, style, onSave, onCancel }) {
  const [primary, setPrimary] = useState(profile?.preferred_position || "Flexible");
  const [draft, setDraft] = useState(() => (style ? { ...style } : { secondary_position: null, ...starterStyle(profile?.preferred_position) }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const left = STYLE_POINTS - usedPoints(draft);

  async function submit(e) {
    e.preventDefault();
    const err = validateStyle(draft, primary);
    if (err) { setError(err); return; }
    setBusy(true); setError("");
    try { await onSave({ primary, style: draft }); }
    catch (ex) { setError(ex?.message || "No se pudo guardar tu estilo."); }
    finally { setBusy(false); }
  }

  return (
    <form className="pb-builder md-form" onSubmit={submit} aria-label="Crear mi estilo">
      <p className="pb-note">Esto es cómo te ves vos: sirve para armar equipos parejos cuando todavía no hay historial. No cambia tu rating oficial, tus estadísticas ni tus logros.</p>
      {error && <p className="form-message" role="alert">{error}</p>}
      <div className="pb-positions">
        <label>Posición principal
          <select value={primary} onChange={(e) => setPrimary(e.target.value)}>
            {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label>Posición secundaria <small>(opcional)</small>
          <select value={draft.secondary_position || ""} onChange={(e) => setDraft((d) => ({ ...d, secondary_position: e.target.value || null }))}>
            <option value="">Ninguna</option>
            {POSITIONS.filter((p) => p.id !== primary || p.id === "Flexible").map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="pb-points">
        <legend>Repartí {STYLE_POINTS} puntos <b className={left === 0 ? "is-ok" : ""} aria-live="polite">{left === 0 ? "Listo" : `Quedan ${left}`}</b></legend>
        {STYLE_KEYS.map(({ key, label, hint }) => (
          <div className="pb-point" key={key}>
            <span><b>{label}</b><small>{hint}</small></span>
            <span className="mdd-stepper" role="group" aria-label={label}>
              <button type="button" aria-label={`Restar a ${label}`} onClick={() => setDraft((d) => adjustPoint(d, key, -1))} disabled={!draft[key]}><Minus size={16} aria-hidden="true" /></button>
              <b>{draft[key] || 0}</b>
              <button type="button" aria-label={`Sumar a ${label}`} onClick={() => setDraft((d) => adjustPoint(d, key, 1))} disabled={left <= 0}><Plus size={16} aria-hidden="true" /></button>
            </span>
          </div>
        ))}
      </fieldset>
      <div className="md-form-actions">
        {onCancel && <button type="button" className="md-btn md-btn-ghost" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="md-btn md-btn-accent" disabled={busy || left !== 0}>{busy ? "Guardando…" : "Guardar mi estilo"}</button>
      </div>
    </form>
  );
}

/** Three layers: style (self-declared), verified record, achievements. */
export function PlayerLayers({ profile, activeGroupId, ratingObj, matches, attendances, matchStats, onSavePosition, styleApi = defaultApi, canEdit = true }) {
  const [style, setStyle] = useState(undefined); // undefined = loading, null = none, false = unavailable
  const [closures, setClosures] = useState([]);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    if (!profile?.id) return undefined;
    styleApi.listPlayerStyles([profile.id])
      .then((rows) => { if (alive) setStyle(rows?.[0] || null); })
      .catch(() => { if (alive) setStyle(false); });
    if (activeGroupId) styleApi.listPostmatchClosures(activeGroupId).then((r) => alive && setClosures(r || [])).catch(() => {});
    return () => { alive = false; };
  }, [profile?.id, activeGroupId, styleApi]);

  const record = useMemo(() => verifiedRecord({ profileId: profile?.id, matches, attendances, stats: matchStats, closures, rating: ratingObj }), [profile?.id, matches, attendances, matchStats, closures, ratingObj]);
  const earned = useMemo(() => achievements(record), [record]);

  async function save({ primary, style: s }) {
    if (primary !== profile.preferred_position) await onSavePosition(primary);
    const row = await styleApi.savePlayerStyle(profile.id, s);
    setStyle(row); setEditing(false); setNotice("Tu estilo quedó guardado.");
  }

  return (
    <section className="pv-section pb-layers" aria-labelledby="pb-title" data-player-layers>
      <div className="mdd-head"><h2 id="pb-title">Mi jugador</h2><small>Estilo propio, datos verificados y logros</small></div>
      {notice && <p className="rd-ok" role="status">{notice}</p>}
      <div className="pb-grid">
        <article className="pb-card is-style" aria-labelledby="pb-style-t">
          <header><Sparkles size={16} aria-hidden="true" /><h3 id="pb-style-t">Estilo</h3><span className="pb-tag">Autodeclarado</span></header>
          {style === undefined && <p className="fx-hint" role="status">Cargando…</p>}
          {style === false && <p className="fx-hint">El estilo todavía no está disponible en este grupo.</p>}
          {style !== undefined && style !== false && !editing && (
            style ? (
              <>
                <p className="pb-pos">{positionLabel(profile?.preferred_position)}{style.secondary_position ? ` · también ${positionLabel(style.secondary_position).toLowerCase()}` : ""}</p>
                <StyleBars style={style} />
                {canEdit && <button type="button" className="md-btn md-btn-ghost fx-btn-sm" onClick={() => setEditing(true)}><PencilLine size={14} aria-hidden="true" /> Actualizar estilo</button>}
              </>
            ) : (
              <div className="pb-empty">
                <p>Contá cómo jugás: posición y en qué sos fuerte. Ayuda a armar equipos parejos desde tu primer partido.</p>
                {canEdit && <button type="button" className="md-btn md-btn-accent" onClick={() => setEditing(true)}>Crear mi estilo</button>}
              </div>
            )
          )}
          {editing && <PlayerBuilder profile={profile} style={style || null} onSave={save} onCancel={() => setEditing(false)} />}
        </article>
        <article className="pb-card is-verified" aria-labelledby="pb-ver-t">
          <header><BadgeCheck size={16} aria-hidden="true" /><h3 id="pb-ver-t">Verificado</h3><span className="pb-tag is-ok">Datos oficiales</span></header>
          <dl className="pb-record">
            <div><dt>Partidos</dt><dd>{record.played}</dd></div>
            <div><dt>Goles</dt><dd>{record.goals}</dd></div>
            <div><dt>Asistencias</dt><dd>{record.assists}</dd></div>
            <div><dt>MVP</dt><dd>{record.mvps}</dd></div>
          </dl>
          <p className="fx-hint">{record.officialRating != null ? `Rating oficial asignado por la administración: ${record.officialRating}.` : "Todavía sin rating oficial: lo asigna la administración."}</p>
        </article>
        <article className="pb-card is-awards" aria-labelledby="pb-aw-t">
          <header><Award size={16} aria-hidden="true" /><h3 id="pb-aw-t">Logros</h3></header>
          {earned.length === 0 ? <p className="fx-hint">Se desbloquean jugando: debut, primer gol confirmado, MVP elegido por tus compañeros…</p> : (
            <ul className="pb-awards">{earned.map((a) => <li key={a.id}><b>{a.label}</b><small>{a.desc}</small></li>)}</ul>
          )}
        </article>
      </div>
    </section>
  );
}
