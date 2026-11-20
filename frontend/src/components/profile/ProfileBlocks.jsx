import React from "react";
import Avatar from "../Avatar.jsx";
import PlayerBadge from "../PlayerBadge.jsx";
import { SKILL_OPTIONS } from "../../constants.js";
import { displayName, positionLabel } from "../../utils.js";
import { positionShort } from "../../matchday/matchDetailModel.js";
import { MIN_HISTORY_FOR_EVOLUTION } from "../../players/playerStats.js";

/*
 * Sporting-profile building blocks (Jugadores, Mi FIFA, future F5 Passport).
 * Contract: they only receive public sporting data (name/nickname, avatar, position,
 * tier, skills, verified stats). Contact data and finances are NEVER passed here.
 */

const SKILL_MAP = Object.fromEntries(SKILL_OPTIONS.map((o) => [o.id, o]));

export function skillIdsOf(skills, profileId) {
  return (skills || []).filter((s) => s.player_id === profileId).map((s) => s.skill);
}

export function PlayerIdentity({ profile, rating, active, variant = "editorial", size = "lg", meta }) {
  return (
    <div className={`pf-identity is-${variant} size-${size}`}>
      <Avatar profile={profile} size={size === "lg" ? "md" : "sm"} />
      <div className="pf-identity-text">
        <span className="pf-pos">{positionShort(profile?.preferred_position)} · {positionLabel(profile?.preferred_position || "Flexible")}</span>
        <strong className="pf-name">{displayName(profile)}</strong>
        <span className="pf-meta">
          <PlayerBadge rating={rating} />
          {typeof active === "boolean" && <span className={`pf-status ${active ? "is-on" : ""}`}>{active ? "Activo" : "Inactivo"}</span>}
          {meta}
        </span>
      </div>
    </div>
  );
}

export function StatTiles({ stats, variant = "editorial", compact = false }) {
  const tiles = [
    ["Partidos", stats.matchesPlayed, "con estadísticas"],
    ["Goles", stats.goals],
    ["Asistencias", stats.assists],
    ["MVP", stats.mvps],
    ["Vallas", stats.cleanSheets],
    ["Voto", stats.voteAverage > 0 ? stats.voteAverage.toFixed(1) : "—", stats.voteCount ? `${stats.voteCount} votos` : "sin votos"],
  ];
  return (
    <dl className={`pf-tiles is-${variant}${compact ? " is-compact" : ""}`}>
      {tiles.map(([label, value, hint]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
          {hint && !compact && <small>{hint}</small>}
        </div>
      ))}
    </dl>
  );
}

export function ReliabilityLine({ stats }) {
  return (
    <p className="pf-reliability">
      <span><b>{stats.confirmedAttendances}</b> confirmaciones</span>
      <span><b>{stats.canceledAttendances}</b> cancelaciones</span>
      <span><b>{stats.noShows}</b> ausencias</span>
      <span>Confiabilidad <b>{stats.reliabilityScore}</b></span>
    </p>
  );
}

export function SkillChips({ skillIds = [], empty = "Sin habilidades especiales asignadas." }) {
  const list = skillIds.map((id) => SKILL_MAP[id]).filter(Boolean);
  if (list.length === 0) return <p className="pf-empty">{empty}</p>;
  return (
    <ul className="pf-skills">
      {list.map((s) => (
        <li key={s.id} title={s.desc}>
          <span aria-hidden="true">{s.emoji}</span>
          <b>{s.label}</b>
          <small>{s.desc}</small>
        </li>
      ))}
    </ul>
  );
}

/** Evolution only renders with enough recorded matches; otherwise explains why it is hidden. */
export function EvolutionStrip({ timeline = [], variant = "editorial" }) {
  if (timeline.length < MIN_HISTORY_FOR_EVOLUTION) {
    return (
      <p className="pf-empty">
        La evolución aparece cuando haya al menos {MIN_HISTORY_FOR_EVOLUTION} partidos con estadísticas registradas
        {timeline.length ? ` (ahora: ${timeline.length})` : ""}.
      </p>
    );
  }
  const recent = timeline.slice(-10);
  const max = Math.max(1, ...recent.map((t) => t.goals + t.assists));
  return (
    <div className={`pf-evolution is-${variant}`} role="img" aria-label={`Goles y asistencias en los últimos ${recent.length} partidos registrados`}>
      {recent.map((t) => (
        <div key={t.id} className="pf-evo-col" title={`${t.title}${t.date ? ` · ${t.date}` : ""}: ${t.goals} G, ${t.assists} A${t.mvp ? ", MVP" : ""}`}>
          <span className="pf-evo-bar">
            <i className="g" style={{ blockSize: `${(t.goals / max) * 100}%` }} />
            <i className="a" style={{ blockSize: `${(t.assists / max) * 100}%` }} />
          </span>
          <small>{t.mvp ? "★" : t.date ? t.date.slice(8, 10) : "·"}</small>
        </div>
      ))}
    </div>
  );
}
