import React from "react";
import { CalendarDays, ChevronRight, History, MapPin, Plus } from "lucide-react";
import {
  ActionButton,
  AdminActions,
  DeleteControl,
  HistoryFilter,
  HistoryMore,
  QuickConfirm,
  StateChip,
  StateIcon,
} from "./shared.jsx";
import PlayerFace, { playerPhotoUrl } from "../PlayerFace.jsx";

/** Splits N tokens into pitch columns (e.g. 15 → 3·4·4·4, like the prototype). */
export function lineupColumns(total) {
  const cols = total <= 8 ? 3 : total <= 16 ? 4 : total <= 24 ? 5 : 6;
  const base = Math.floor(total / cols);
  const extra = total % cols;
  // Fewer tokens in the first column (goal side), extras go to the back columns.
  return Array.from({ length: cols }, (_, i) => base + (i >= cols - extra ? 1 : 0));
}

/**
 * B — Sports Command Center.
 * Immersive: pitch with player tokens, scoreboard clock, quorum ring,
 * upcoming strip with capacity segments and a history ledger.
 */
export default function CommandMatchesView({
  model,
  admin,
  createForm,
  history,
  deletion,
  actions,
  onOpenMatch,
  upcomingCount,
  playedCount,
  onOpenPlayer,
  onboarding = null,
}) {
  const { featured, agenda, lastPlayed } = model;

  return (
    <div className={`mdc${featured ? " has-dock" : admin.isAdmin ? " has-dock" : ""}`}>
      <div className="mdc-bar">
        <h1>Partidos</h1>
        <span className="mdc-pill">
          <CalendarDays size={14} aria-hidden="true" /> <b>{upcomingCount}</b> {upcomingCount === 1 ? "próximo" : "próximos"}
        </span>
        <span className="mdc-pill">
          <History size={14} aria-hidden="true" /> <b>{playedCount}</b> {playedCount === 1 ? "jugado" : "jugados"}
        </span>
        <span className="mdc-sp" />
        <AdminActions {...admin} />
      </div>

      {createForm}
      {onboarding}

      {featured ? (
        <CommandArena entry={featured} actions={actions} onOpenPlayer={onOpenPlayer} />
      ) : (
        <section className="mdc-arena is-empty" data-match-state="empty" aria-labelledby="mdc-empty-title">
          <div className="mdc-emptyarena">
            <span className="md-chip tone-mute">
              <StateIcon stateKey="empty" size={14} /> Sin próximos partidos
            </span>
            <h2 id="mdc-empty-title">
              Cancha
              <br />
              libre
            </h2>
            <p>
              {admin.isAdmin
                ? "No hay convocatorias activas. Programa el próximo partido y avisa al grupo."
                : "No hay convocatorias activas. Cuando la administración programe un partido aparecerá aquí."}
            </p>
            {admin.isAdmin && (
              <button type="button" className="md-btn md-btn-accent md-btn-lg" onClick={admin.onToggleCreate}>
                <Plus size={18} aria-hidden="true" /> Nuevo partido
              </button>
            )}
            {lastPlayed && (
              <button type="button" className="md-linkbtn" onClick={() => onOpenMatch(lastPlayed.id)}>
                Último partido: {lastPlayed.parts.longLabel} · {lastPlayed.title}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="mdc-lower">
        <section aria-labelledby="mdc-next-title">
          <div className="mdc-sec-t">
            <h2 id="mdc-next-title">Próximos</h2>
            <small>
              {agenda.length} {agenda.length === 1 ? "partido programado" : "partidos programados"}
            </small>
          </div>
          <div className="mdc-strip">
            {agenda.map((entry) => (
              // Card = div with a full-size "open" button underneath a real "+ Confirmarme" action
              // (a button cannot contain another button).
              <div key={entry.id} className="mdc-mcard">
                <button
                  type="button"
                  className="mdc-mcard-open"
                  aria-label={`Ver partido ${entry.title}, ${entry.parts.dow} ${entry.parts.day} ${entry.parts.mon}`}
                  onClick={() => onOpenMatch(entry.id)}
                />
                <span className="mdc-mcard-top">
                  <span className="mdc-dt">
                    <b>{entry.parts.day}</b>
                    <span>
                      {entry.parts.dow} {entry.parts.mon}
                    </span>
                  </span>
                  <QuickConfirm entry={entry} actions={actions} />
                </span>
                <span className="mdc-mcard-body">
                  <span className="mdc-mcard-title">{entry.title}</span>
                  <span className="mdc-mcard-sub">
                    {entry.parts.time || "Hora pendiente"}
                    {entry.venue && entry.venue !== entry.title ? ` · ${entry.venue}` : ""}
                  </span>
                </span>
                <span className="mdc-segwrap">
                  <span
                    className="mdc-seg"
                    style={{ gridTemplateColumns: `repeat(${Math.min(entry.capacity, 24)}, 1fr)` }}
                    role="img"
                    aria-label={`${entry.confirmedCount} de ${entry.capacity} confirmados`}
                  >
                    {Array.from({ length: Math.min(entry.capacity, 24) }, (_, i) => (
                      <i
                        key={i}
                        className={
                          i < Math.round((entry.confirmedCount / entry.capacity) * Math.min(entry.capacity, 24))
                            ? "on"
                            : ""
                        }
                      />
                    ))}
                  </span>
                  <span className="mdc-seg-l">
                    <span>
                      {entry.confirmedCount}/{entry.capacity} confirmados
                    </span>
                    <span>{entry.free > 0 ? `${entry.free} cupos` : "Completo"}</span>
                  </span>
                </span>
              </div>
            ))}
            {admin.isAdmin ? (
              <button type="button" className="mdc-ghostcard" onClick={admin.onToggleCreate}>
                <Plus size={26} aria-hidden="true" />
                <span>
                  Programa otro partido
                  <br />y llena la cancha
                </span>
              </button>
            ) : (
              agenda.length === 0 && (
                <div className="mdc-ghostcard is-static">
                  <span>No hay más partidos programados por ahora.</span>
                </div>
              )
            )}
          </div>
        </section>

        <section aria-labelledby="mdc-hist-title">
          <div className="mdc-sec-t">
            <h2 id="mdc-hist-title">Historial</h2>
            <small>{history.summary}</small>
          </div>
          <HistoryFilter {...history.filter} />
          {history.entries.length === 0 ? (
            <p className="mdc-note">{history.emptyText}</p>
          ) : (
            <ul className="mdc-ledger">
              {history.entries.map((entry) => (
                <li key={entry.id}>
                  <button type="button" className="mdc-ledger-row" onClick={() => onOpenMatch(entry.id)}>
                    <span className="mdc-n">{entry.parts.day}</span>
                    <span className="mdc-ledger-main">
                      <small>
                        {entry.parts.dow} {entry.parts.mon} {entry.parts.year}
                      </small>
                      <span className="mdc-ledger-title">{entry.title}</span>
                      <span className="mdc-ledger-sub">
                        {entry.state.key === "cancelled" ? (
                          <StateChip state={entry.state} size={11} />
                        ) : (
                          `${entry.confirmedCount} jugadores`
                        )}
                      </span>
                    </span>
                    <ChevronRight size={18} className="mdc-go" aria-hidden="true" />
                  </button>
                  <DeleteControl entry={entry} deletion={deletion} />
                </li>
              ))}
            </ul>
          )}
          <HistoryMore history={history} />
        </section>
      </div>

      <CommandDock featured={featured} admin={admin} actions={actions} />
    </div>
  );
}

export function CommandArena({ entry, actions, onOpenPlayer }) {
  const { state, parts, roster, capacity, confirmedCount, free } = entry;
  const busy = actions.busyId === entry.id;
  const total = Math.max(capacity, roster.length);
  const cols = lineupColumns(total);
  const pct = Math.round((confirmedCount / capacity) * 100);
  const ringColor =
    state.key === "cancelled" ? "var(--md-text-3)" : state.tone === "warn" ? "var(--md-warn)" : "var(--md-accent)";
  let k = 0;

  return (
    <section className={`mdc-arena is-${state.key}`} aria-labelledby="mdc-arena-title" data-match-state={state.key}>
      <div className="mdc-pitchwrap">
        <div className="mdc-pitch" aria-hidden="true">
          <span className="mdc-box l" />
          <span className="mdc-box r" />
        </div>
        <div className="mdc-tag">
          <StateChip state={state} />
          {parts.whenTag && state.key !== "finished" && <span className="mdc-when">{parts.whenTag}</span>}
        </div>
        <div className="mdc-lineup" role="group" aria-label={`${confirmedCount} de ${capacity} confirmados`}>
          {cols.map((count, c) => (
            <div className="mdc-lcol" key={c}>
              {Array.from({ length: count }, () => {
                const p = roster[k];
                const idx = k++;
                const cls = `mdc-tok${p ? " on" : ""}${p?.isMe ? " me" : ""}${p?.isGuest ? " guest" : ""}${playerPhotoUrl(p?.profile) ? " has-photo" : ""}`;
                if (!p) {
                  return <span key={`free-${idx}`} className={cls} title="Cupo libre" aria-hidden="true">+</span>;
                }
                // Radar players (outside the group) keep initials and no card: their profile is not the group's to show.
                const canOpen = Boolean(onOpenPlayer) && (p.isGuest || (p.profile && !p.profile.is_radar));
                return (
                  <button
                    type="button"
                    key={p.id}
                    className={cls}
                    title={p.name}
                    aria-label={canOpen ? `Ver ficha de ${p.name}` : p.name}
                    disabled={!canOpen}
                    onClick={() => onOpenPlayer(p.isGuest ? { isGuest: true, full_name: p.name, guestRating: p.guestRating || 3 } : p.profile)}
                  >
                    <PlayerFace profile={p.profile} initial={p.initial} size={50} />
                    <small>{p.name}</small>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mdc-legend" aria-hidden="true">
          <span>
            <i />
            Confirmado
          </span>
          <span>
            <i className="e" />
            Cupo libre
          </span>
        </div>
      </div>

      <div className="mdc-score">
        <div className="mdc-eyebrow">
          {state.key === "finished"
            ? "Último partido"
            : `${parts.whenTag ? `${parts.whenTag} · ` : ""}${parts.longLabel}`}
        </div>
        <div className="mdc-clock">{parts.time || "--:--"}</div>
        <div>
          <h2 className="mdc-venue" id="mdc-arena-title">
            {entry.title}
          </h2>
          <div className="mdc-sub">
            {entry.place && (
              <span>
                <MapPin size={15} aria-hidden="true" /> {entry.place}
              </span>
            )}
            <span>
              <CalendarDays size={15} aria-hidden="true" /> {parts.longLabel}
            </span>
          </div>
        </div>
        <div className="mdc-quorum">
          <div className="mdc-ring" style={{ "--p": Math.min(100, pct), "--c": ringColor }}>
            <b>
              {confirmedCount}/{capacity}
            </b>
          </div>
          <p>
            <b>{state.key === "finished" ? "Jugaron" : "Quórum"}</b>
            {state.key === "finished"
              ? `${confirmedCount} jugadores`
              : state.key === "cancelled"
                ? "Convocatoria cerrada"
                : free > 0
                  ? `${free} ${free === 1 ? "cupo libre" : "cupos libres"}`
                  : entry.waitlistCount > 0
                    ? `Sin cupos · ${entry.waitlistCount} en espera`
                    : "Sin cupos"}
          </p>
        </div>
        <div className={`mdc-st tone-${state.tone}`} role="status">
          <StateIcon stateKey={state.key} size={20} />
          <div>
            <b>{state.status}</b>
            {state.sub}
          </div>
        </div>
        <div className="mdc-acts">
          <ActionButton action={state.primary} match={entry.match} run={actions.run} busy={busy} className="md-btn mdc-cta" />
          <ActionButton
            action={state.secondary}
            match={entry.match}
            run={actions.run}
            busy={busy}
            className="md-btn md-btn-ghost mdc-sec"
          />
        </div>
      </div>
    </section>
  );
}

/** Mobile-only action bar pinned above the bottom navigation. */
function CommandDock({ featured, admin, actions }) {
  if (!featured) {
    if (!admin.isAdmin) return null;
    return (
      <div className="mdc-dock">
        <button type="button" className="md-btn mdc-cta" onClick={admin.onToggleCreate}>
          Nuevo partido
        </button>
      </div>
    );
  }
  const { state } = featured;
  const busy = actions.busyId === featured.id;
  return (
    <div className="mdc-dock" aria-label="Acción del próximo partido">
      <div className={`mdc-dock-st tone-${state.tone}`}>
        <span>
          <StateIcon stateKey={state.key} size={18} />
          <b>{state.status}</b>
        </span>
        <ActionButton
          action={state.secondary}
          match={featured.match}
          run={actions.run}
          busy={busy}
          className="md-linkbtn"
        />
      </div>
      <ActionButton action={state.primary} match={featured.match} run={actions.run} busy={busy} className="md-btn mdc-cta" />
    </div>
  );
}
