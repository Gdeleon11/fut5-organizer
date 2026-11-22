import React from "react";
import { ArrowRight, ChevronRight, MapPin, Plus } from "lucide-react";
import {
  ActionButton,
  AdminActions,
  DeleteControl,
  HistoryFilter,
  HistoryMore,
  QuickConfirm,
  quickConfirmAction,
  StateChip,
  StateIcon,
} from "./shared.jsx";

/**
 * A — Matchday Editorial.
 * Typography-led: giant date, hairlines instead of nested cards, one accent action,
 * agenda + history as two editorial columns.
 */
export default function EditorialMatchesView({
  model,
  groupName,
  admin,
  createForm,
  history,
  deletion,
  actions,
  onOpenMatch,
}) {
  const { featured, agenda, lastPlayed } = model;

  return (
    <div className="mde">
      <div className="mde-topline">
        <span className="mde-crumb">{groupName ? `${groupName} · ` : ""}Partidos</span>
        <AdminActions {...admin} />
      </div>

      {createForm}

      {featured ? (
        <EditorialHero entry={featured} actions={actions} />
      ) : (
        <EditorialEmpty admin={admin} lastPlayed={lastPlayed} onOpenMatch={onOpenMatch} />
      )}

      <div className="mde-cols">
        <section className="mde-agenda" aria-labelledby="mde-agenda-title">
          <h2 className="mde-h2" id="mde-agenda-title">
            Agenda
            <small>
              {agenda.length} {agenda.length === 1 ? "partido programado" : "partidos programados"}
            </small>
          </h2>
          <ul className="mde-rows">
            {agenda.map((entry) => (
              <li key={entry.id} className={quickConfirmAction(entry.state) ? "mde-agenda-item has-quick" : "mde-agenda-item"}>
                <button type="button" className="mde-row" onClick={() => onOpenMatch(entry.id)}>
                  <span className="mde-d">
                    <small>{entry.parts.dow}</small>
                    <b>{entry.parts.day}</b>
                  </span>
                  <span className="mde-row-main">
                    <span className="mde-row-title">{entry.title}</span>
                    <span className="mde-row-sub">
                      <span>{entry.parts.time || "Hora pendiente"}</span>
                      <span>{entry.parts.mon}</span>
                      <span>
                        {entry.confirmedCount}/{entry.capacity}
                      </span>
                    </span>
                  </span>
                  <span
                    className="mde-bar"
                    role="img"
                    aria-label={`${entry.confirmedCount} de ${entry.capacity} confirmados`}
                  >
                    <i style={{ inlineSize: `${Math.round(entry.fillRatio * 100)}%` }} />
                  </span>
                  {!quickConfirmAction(entry.state) && <StateChip state={entry.state} size={12} />}
                </button>
                {quickConfirmAction(entry.state) && <QuickConfirm entry={entry} actions={actions} />}
              </li>
            ))}
          </ul>
          {agenda.length === 0 && <p className="mde-note">No hay más partidos programados por ahora.</p>}
          {admin.isAdmin && (
            <button type="button" className="mde-add-row" onClick={admin.onToggleCreate}>
              <Plus size={18} aria-hidden="true" /> Programar otro partido
            </button>
          )}
        </section>

        <section className="mde-hist" aria-labelledby="mde-hist-title">
          <h2 className="mde-h2" id="mde-hist-title">
            Historial
            <small>{history.summary}</small>
          </h2>
          <HistoryFilter {...history.filter} />
          {history.entries.length === 0 ? (
            <p className="mde-note">{history.emptyText}</p>
          ) : (
            <ul className="mde-rows">
              {history.entries.map((entry) => (
                <li key={entry.id} className="mde-hist-item">
                  <button type="button" className="mde-row" onClick={() => onOpenMatch(entry.id)}>
                    <span className="mde-d">
                      <small>{entry.parts.dow}</small>
                      <b>{entry.parts.day}</b>
                    </span>
                    <span className="mde-row-main">
                      <span className="mde-row-title">{entry.title}</span>
                      <span className="mde-row-sub">
                        <span>
                          {entry.parts.mon} {entry.parts.year}
                        </span>
                        {entry.state.key === "cancelled" ? (
                          <StateChip state={entry.state} size={11} />
                        ) : (
                          <span>{entry.confirmedCount} jugadores</span>
                        )}
                      </span>
                    </span>
                    <ChevronRight size={18} className="mde-go" aria-hidden="true" />
                  </button>
                  <DeleteControl entry={entry} deletion={deletion} />
                </li>
              ))}
            </ul>
          )}
          <HistoryMore history={history} />
        </section>
      </div>
    </div>
  );
}

export function EditorialHero({ entry, actions }) {
  const { state, parts, roster, capacity, confirmedCount, free } = entry;
  const busy = actions.busyId === entry.id;
  const slots = Math.max(capacity, roster.length);
  const countNote =
    state.key === "finished"
      ? "partido jugado"
      : state.key === "cancelled"
        ? "sin convocatoria"
        : free > 0
          ? `${free} ${free === 1 ? "cupo libre" : "cupos libres"}`
          : "completo";

  return (
    <section className={`mde-hero is-${state.key}`} aria-labelledby="mde-hero-title" data-match-state={state.key}>
      <div className="mde-hero-grid">
        <div className="mde-date" aria-hidden="true">
          <div className="mde-day">{parts.day}</div>
          <div className="mde-mon">
            {parts.dow}
            <br />
            {parts.mon}
          </div>
        </div>

        <div className="mde-info">
          <div className="mde-kicker">
            <StateChip state={state} />
            <span>
              {state.key === "finished"
                ? "Último partido"
                : `Próximo partido${parts.whenTag ? ` · ${parts.whenTag}` : ""}`}
            </span>
          </div>
          <h1 className="mde-venue" id="mde-hero-title">
            {entry.title}
          </h1>
          <div className="mde-meta">
            <span className="mde-time">{parts.time || "--:--"}</span>
            <span className="sr-only">{parts.longLabel}</span>
            {entry.place && (
              <span>
                <MapPin size={16} aria-hidden="true" /> {entry.place}
              </span>
            )}
          </div>
          <div className="mde-slots" role="img" aria-label={`${confirmedCount} de ${capacity} confirmados`}>
            {Array.from({ length: slots }, (_, i) => {
              const p = roster[i];
              return (
                <span
                  key={p ? p.id : `free-${i}`}
                  className={`mde-slot${p ? " on" : ""}${p?.isMe ? " me" : ""}${p?.isGuest ? " guest" : ""}`}
                  title={p ? p.name : undefined}
                >
                  {p ? p.initial : ""}
                </span>
              );
            })}
          </div>
          <div className="mde-count">
            <b>
              {confirmedCount}/{capacity}
            </b>
            <span>confirmados</span>
            <em>· {countNote}</em>
          </div>
        </div>

        <div className="mde-act">
          <div className={`mde-status tone-${state.tone}`} role="status">
            <b>
              <StateIcon stateKey={state.key} size={22} /> {state.status}
            </b>
            <p>{state.sub}</p>
          </div>
          <div className="mde-actions">
            {state.primary && (
              <ActionButton
                action={state.primary}
                match={entry.match}
                run={actions.run}
                busy={busy}
                className="md-btn md-btn-primary md-btn-block"
              />
            )}
            {state.secondary && (
              <ActionButton
                action={state.secondary}
                match={entry.match}
                run={actions.run}
                busy={busy}
                className="md-linkbtn"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorialEmpty({ admin, lastPlayed, onOpenMatch }) {
  return (
    <section className="mde-empty is-empty" data-match-state="empty" aria-labelledby="mde-empty-title">
      <span className="md-chip tone-mute">
        <StateIcon stateKey="empty" size={14} /> Sin próximos partidos
      </span>
      <h1 id="mde-empty-title">
        La cancha
        <br />
        está libre.
      </h1>
      <p>
        {admin.isAdmin
          ? "No hay convocatorias activas. Programa el próximo partido y avisa al grupo."
          : "No hay convocatorias activas. Cuando la administración programe un partido aparecerá aquí."}
      </p>
      {admin.isAdmin && (
        <button type="button" className="md-btn md-btn-primary" onClick={admin.onToggleCreate}>
          <Plus size={18} aria-hidden="true" /> Nuevo partido
        </button>
      )}
      {lastPlayed && (
        <button type="button" className="md-linkbtn mde-last" onClick={() => onOpenMatch(lastPlayed.id)}>
          Último partido: {lastPlayed.parts.longLabel} · {lastPlayed.title} <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
