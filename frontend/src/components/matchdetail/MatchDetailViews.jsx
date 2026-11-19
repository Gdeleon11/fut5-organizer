import React from "react";
import { ArrowLeft, CalendarDays, Clock, Shield, Users } from "lucide-react";
import { EditorialHero } from "../matchday/EditorialMatchesView.jsx";
import { CommandArena } from "../matchday/CommandMatchesView.jsx";
import { ActionButton, StateIcon } from "../matchday/shared.jsx";
import {
  AdminTools,
  RosterSection,
  SummarySection,
  TeamsSection,
  VenueSection,
  WaitlistSection,
} from "./DetailBlocks.jsx";

function AnchorNav({ vm, admin }) {
  const links = [
    ["convocatoria", "Convocatoria"],
    ["equipos", "Equipos"],
    vm.isClosed ? ["resumen", "Resultado"] : null,
    ["cancha", "La cancha"],
    admin ? ["admin", "Administración"] : null,
  ].filter(Boolean);
  return (
    <nav className="mdd-anchors" aria-label="Secciones del partido">
      {links.map(([id, label]) => (
        <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          {label}
        </a>
      ))}
    </nav>
  );
}

/**
 * A — Matchday Editorial match detail.
 * Same giant-date hero as Partidos, then hairline editorial sections in two columns.
 */
export function EditorialMatchDetail({ vm, entry, actions, onBack, shared, admin }) {
  return (
    <div className="mdd mdd-editorial mde">
      <div className="mdd-topline">
        <button type="button" className="md-linkbtn mdd-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Partidos
        </button>
        <span className="mde-crumb">Detalle del partido</span>
      </div>
      <EditorialHero entry={entry} actions={actions} />
      <AnchorNav vm={vm} admin={Boolean(admin)} />
      <div className="mdd-ed-cols">
        <div className="mdd-ed-col">
          <RosterSection vm={vm} variant="editorial" {...shared.roster} />
          <WaitlistSection vm={vm} variant="editorial" />
        </div>
        <div className="mdd-ed-col">
          <TeamsSection vm={vm} variant="editorial" isAdmin={shared.isAdmin} onOpenPlayer={shared.roster.onOpenPlayer} />
        </div>
      </div>
      <SummarySection vm={vm} variant="editorial" {...shared.summary} />
      <VenueSection vm={vm} variant="editorial" />
      {admin && <div id="admin">{React.cloneElement(admin, { variant: "editorial" })}</div>}
    </div>
  );
}

/**
 * B — Sports Command Center match detail.
 * Pitch + scoreboard arena, then a tactical dashboard: formation, squad, waitlist, venue, admin.
 */
export function CommandMatchDetail({ vm, entry, actions, onBack, shared, admin }) {
  const busy = actions.busyId === vm.match.id;
  return (
    <div className="mdd mdd-command mdc has-dock">
      <div className="mdc-bar">
        <button type="button" className="md-btn md-btn-ghost md-btn-sm mdd-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Partidos
        </button>
        <h1>Partido</h1>
        <span className="mdc-pill"><Users size={14} aria-hidden="true" /> <b>{vm.confirmedCount}</b>/{vm.capacity}</span>
        {vm.waitlist.length > 0 && <span className="mdc-pill"><Clock size={14} aria-hidden="true" /> <b>{vm.waitlist.length}</b> en espera</span>}
        <span className="mdc-pill"><Shield size={14} aria-hidden="true" /> <b>{vm.teams.length}</b> equipos</span>
        <span className="mdc-pill"><CalendarDays size={14} aria-hidden="true" /> {vm.parts.longLabel}</span>
      </div>
      <CommandArena entry={entry} actions={actions} />
      <AnchorNav vm={vm} admin={Boolean(admin)} />
      <div className="mdd-cc-grid">
        <div className="mdd-cc-main">
          <TeamsSection vm={vm} variant="command" isAdmin={shared.isAdmin} onOpenPlayer={shared.roster.onOpenPlayer} />
          <RosterSection vm={vm} variant="command" {...shared.roster} />
          <SummarySection vm={vm} variant="command" {...shared.summary} />
        </div>
        <aside className="mdd-cc-side">
          <WaitlistSection vm={vm} variant="command" />
          <VenueSection vm={vm} variant="command" />
          {admin && <div id="admin">{React.cloneElement(admin, { variant: "command" })}</div>}
        </aside>
      </div>
      {(entry.state.primary || entry.state.secondary) && (
        <div className="mdc-dock" aria-label="Acción del partido">
          <div className={`mdc-dock-st tone-${entry.state.tone}`}>
            <span>
              <StateIcon stateKey={entry.state.key} size={18} />
              <b>{entry.state.status}</b>
            </span>
            {entry.state.primary && (
              <ActionButton action={entry.state.secondary} match={vm.match} run={actions.run} busy={busy} className="md-linkbtn" />
            )}
          </div>
          <ActionButton
            action={entry.state.primary || entry.state.secondary}
            match={vm.match}
            run={actions.run}
            busy={busy}
            className={entry.state.primary ? "md-btn mdc-cta" : "md-btn md-btn-ghost mdc-sec"}
          />
        </div>
      )}
    </div>
  );
}

export { AdminTools };
