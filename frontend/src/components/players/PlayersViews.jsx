import React, { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Crown, Search, Shield, Trophy, Users, X } from "lucide-react";
import Avatar from "../Avatar.jsx";
import PlayerBadge from "../PlayerBadge.jsx";
import FifaCard from "../FifaCard.jsx";
import VoteButtons from "../VoteButtons.jsx";
import CapacityControl from "../CapacityControl.jsx";
import { PositionRatingControl, PositionRatingDisplay } from "../StarRatingControl.jsx";
import { POSITION_OPTIONS, SKILL_OPTIONS } from "../../constants.js";
import { formatTag, parseTags } from "../../tags.js";
import { attendanceLabel, displayName, fineLabel, fineReasonLabel, formatMatchDate, formatMoney, positionLabel } from "../../utils.js";
import { positionShort } from "../../matchday/matchDetailModel.js";
import { SORTERS, canSeePrivate, playerTimeline } from "../../players/playerStats.js";
import { EvolutionStrip, PlayerIdentity, ReliabilityLine, SkillChips, StatTiles, skillIdsOf } from "../profile/ProfileBlocks.jsx";

const POS_FILTERS = [["all", "Todas"], ["Goalkeeper", "POR"], ["Defender", "DEF"], ["Midfielder", "MED"], ["Forward", "DEL"], ["Flexible", "FLX"]];

function Head({ id, title, meta, icon: Icon, action }) {
  return (
    <div className="mdd-head">
      <h2 id={id}>{Icon && <Icon size={18} aria-hidden="true" />}{title}</h2>
      {meta && <small>{meta}</small>}
      {action && <span className="mdd-head-action">{action}</span>}
    </div>
  );
}

/* ============================================================ Directory */
export function PlayerDirectory({ rows, variant, isAdmin, fines, ratingMap, onOpen, onToggleActive }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [pos, setPos] = useState("all");
  const [sort, setSort] = useState("name");
  const [extra, setExtra] = useState("none"); // admin-only: unrated | unpaid

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = rows.filter(({ profile: p }) => {
      if (status === "active" && !p.membership_is_active) return false;
      if (status === "inactive" && p.membership_is_active) return false;
      if (pos !== "all" && (p.preferred_position || "Flexible") !== pos) return false;
      if (query && !`${p.full_name || ""} ${p.nickname || ""}`.toLowerCase().includes(query)) return false;
      if (isAdmin && extra === "unrated" && ratingMap.has(p.id)) return false;
      if (isAdmin && extra === "unpaid" && !fines.some((f) => f.profile_id === p.id && f.status === "open")) return false;
      return true;
    });
    out = [...out].sort(sort === "name" ? (a, b) => displayName(a.profile).localeCompare(displayName(b.profile)) : SORTERS[sort]);
    return out;
  }, [rows, q, status, pos, sort, extra, isAdmin, fines, ratingMap]);

  const active = rows.filter((r) => r.profile.membership_is_active);
  const totals = {
    active: active.length,
    inactive: rows.length - active.length,
    goals: active.reduce((n, r) => n + r.goals, 0),
    mvps: active.reduce((n, r) => n + r.mvps, 0),
  };
  const maxGoals = Math.max(1, ...list.map((r) => r.goals));
  const maxMatches = Math.max(1, ...list.map((r) => r.matchesPlayed));

  const controls = (
    <div className="pl-controls" role="search">
      <label className="pl-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" placeholder="Buscar por nombre o apodo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar jugador" />
      </label>
      <div className="pl-seg" role="group" aria-label="Estado">
        {[["active", "Activos"], ["inactive", "Inactivos"], ["all", "Todos"]].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={status === id} className={status === id ? "is-on" : ""} onClick={() => setStatus(id)}>{label}</button>
        ))}
      </div>
      <label className="pl-select">
        <span>Posición</span>
        <select value={pos} onChange={(e) => setPos(e.target.value)}>
          {POS_FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label className="pl-select">
        <span>Ordenar</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name">Nombre</option>
          <option value="goals">Goles</option>
          <option value="assists">Asistencias</option>
          <option value="mvps">MVP</option>
          <option value="matches">Partidos</option>
          <option value="votes">Voto</option>
        </select>
      </label>
      {isAdmin && (
        <label className="pl-select">
          <span>Admin</span>
          <select value={extra} onChange={(e) => setExtra(e.target.value)}>
            <option value="none">Sin filtro</option>
            <option value="unrated">Sin estrellas</option>
            <option value="unpaid">Con multas abiertas</option>
          </select>
        </label>
      )}
    </div>
  );

  const empty = <p className="pf-empty pl-empty">{rows.length === 0 ? "Los jugadores aparecerán aquí cuando se unan al grupo." : "Ningún jugador coincide con la búsqueda o los filtros."}</p>;

  if (variant === "command") {
    return (
      <div className="pl-cc">
        <div className="pl-cc-metrics" aria-label="Resumen del plantel">
          <div><b>{totals.active}</b><small>Activos</small></div>
          <div><b>{totals.inactive}</b><small>Inactivos</small></div>
          <div><b>{totals.goals}</b><small>Goles registrados</small></div>
          <div><b>{totals.mvps}</b><small>MVP otorgados</small></div>
        </div>
        {controls}
        <p className="pl-count" aria-live="polite">{list.length} {list.length === 1 ? "jugador" : "jugadores"}</p>
        {list.length === 0 ? empty : (
          <ul className="pl-cc-grid">
            {list.map((r) => {
              const p = r.profile;
              return (
                <li key={p.id}>
                  <button type="button" className={`pl-cc-card${p.membership_is_active ? "" : " is-off"}`} onClick={() => onOpen(p.id)}>
                    <span className="pl-cc-top">
                      <span className="pl-cc-pos">{positionShort(p.preferred_position)}</span>
                      <PlayerBadge rating={ratingMap.get(p.id)} />
                    </span>
                    <span className="pl-cc-id">
                      <Avatar profile={p} size="md" />
                      <span>
                        <b>{displayName(p)}</b>
                        <small>{positionLabel(p.preferred_position || "Flexible")}{p.membership_is_active ? "" : " · Inactivo"}</small>
                      </span>
                    </span>
                    <span className="pl-cc-bars">
                      <span><small>Goles</small><i style={{ "--w": `${(r.goals / maxGoals) * 100}%` }} /><b>{r.goals}</b></span>
                      <span><small>Partidos</small><i style={{ "--w": `${(r.matchesPlayed / maxMatches) * 100}%` }} /><b>{r.matchesPlayed}</b></span>
                    </span>
                    <span className="pl-cc-foot">
                      <span><b>{r.assists}</b> A</span>
                      <span><b>{r.mvps}</b> MVP</span>
                      <span><b>{r.voteAverage > 0 ? r.voteAverage.toFixed(1) : "—"}</b> voto</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="pl-ed">
      <p className="pl-ed-lede">
        <b>{totals.active}</b> jugadores activos{totals.inactive ? ` · ${totals.inactive} inactivos` : ""} · <b>{totals.goals}</b> goles registrados
      </p>
      {controls}
      <p className="pl-count" aria-live="polite">{list.length} {list.length === 1 ? "jugador" : "jugadores"}</p>
      {list.length === 0 ? empty : (
        <ol className="pl-ed-list">
          {list.map((r, i) => {
            const p = r.profile;
            return (
              <li key={p.id}>
                <button type="button" className={`pl-ed-row${p.membership_is_active ? "" : " is-off"}`} onClick={() => onOpen(p.id)}>
                  <span className="pl-ed-n">{String(i + 1).padStart(2, "0")}</span>
                  <Avatar profile={p} size="sm" />
                  <span className="pl-ed-name">
                    {displayName(p)}
                    <small>{positionLabel(p.preferred_position || "Flexible")}{p.membership_is_active ? "" : " · Inactivo"}</small>
                  </span>
                  <span className="pl-ed-stats" aria-label={`${r.matchesPlayed} partidos, ${r.goals} goles, ${r.assists} asistencias, ${r.mvps} MVP`}>
                    <span><b>{r.matchesPlayed}</b>PJ</span>
                    <span><b>{r.goals}</b>G</span>
                    <span><b>{r.assists}</b>A</span>
                    <span><b>{r.mvps}</b>MVP</span>
                  </span>
                  <PlayerBadge rating={ratingMap.get(p.id)} />
                  <ChevronRight size={18} aria-hidden="true" className="pl-go" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ============================================================ Player view */
export function PlayerView({
  row, variant, viewerId, isAdmin, isSuperAdmin, ratingMap, skills, matchStats, matches, attendances, fines,
  voteScoreMap, userVoteMap, onVote, onBack, onUpdateMember, onUpdateProfile, onAssignRating, onAddSkill, onRemoveSkill, onCreateGroupTag,
}) {
  const p = row.profile;
  const [tagDraft, setTagDraft] = useState((p.group_tags || []).join(", "));
  const [skillToAdd, setSkillToAdd] = useState("");
  const isSelf = viewerId === p.id;
  const privateOk = canSeePrivate({ viewerId, targetId: p.id, isAdmin });
  const skillRows = (skills || []).filter((s) => s.player_id === p.id);
  const timeline = playerTimeline(p.id, { matchStats, matches });
  const matchById = new Map((matches || []).map((m) => [m.id, m]));
  const history = (attendances || []).filter((a) => a.profile_id === p.id)
    .sort((a, b) => String(matchById.get(b.match_id)?.match_date || "").localeCompare(String(matchById.get(a.match_id)?.match_date || "")))
    .slice(0, 12);
  const playerFines = (fines || []).filter((f) => f.profile_id === p.id);
  const SKILL_MAP = Object.fromEntries(SKILL_OPTIONS.map((o) => [o.id, o]));

  const card = (
    <div className="pv-card">
      <FifaCard profile={p} ratingObj={ratingMap.get(p.id)} playerSkills={skillRows} isGuest={false} matchStats={matchStats} showStats />
    </div>
  );

  const main = (
    <>
      <section className="pv-section" aria-labelledby="pv-stats-title">
        <Head id="pv-stats-title" title={variant === "command" ? "Cumplimiento y voto" : "Estadísticas verificadas"} icon={variant === "command" ? Trophy : null} meta={variant === "command" ? "Métricas principales en la cabecera" : "Registradas en partidos del grupo"} />
        {/* Command shows the stat tiles once, in the hero; Editorial keeps them here */}
        {variant !== "command" && <StatTiles stats={row} variant={variant} />}
        <ReliabilityLine stats={row} />
        {!isSelf && onVote && (
          <div className="pv-vote">
            <span>Tu voto</span>
            <VoteButtons average={voteScoreMap.get(p.id)?.average || 0} totalVotes={voteScoreMap.get(p.id)?.count || 0} userVote={userVoteMap.get(p.id) || 0} onVote={(v) => onVote(p.id, v)} />
          </div>
        )}
      </section>
      <section className="pv-section" aria-labelledby="pv-evo-title">
        <Head id="pv-evo-title" title="Evolución" meta="Goles y asistencias por partido" />
        <EvolutionStrip timeline={timeline} variant={variant} />
      </section>
      <section className="pv-section" aria-labelledby="pv-skills-title">
        <Head id="pv-skills-title" title="Habilidades especiales" meta={`${skillRows.length}/3`} />
        <SkillChips skillIds={skillRows.map((s) => s.skill)} />
        {isSuperAdmin && (
          <div className="pv-admin-inline">
            {skillRows.map((s) => SKILL_MAP[s.skill] && (
              <button key={s.id} type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={() => { if (window.confirm(`¿Quitar ${SKILL_MAP[s.skill].label}?`)) onRemoveSkill(s.id); }}>
                <X size={13} aria-hidden="true" /> {SKILL_MAP[s.skill].label}
              </button>
            ))}
            {skillRows.length < 3 && (
              <label className="pl-select">
                <span>Agregar habilidad</span>
                <select value={skillToAdd} onChange={(e) => { const v = e.target.value; if (v) { onAddSkill(p.id, v); setSkillToAdd(""); } }}>
                  <option value="">Seleccionar…</option>
                  {SKILL_OPTIONS.filter((o) => !skillRows.some((s) => s.skill === o.id)).map((o) => <option key={o.id} value={o.id}>{o.emoji} {o.label}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
      </section>
      <section className="pv-section" aria-labelledby="pv-hist-title">
        <Head id="pv-hist-title" title="Historial de asistencia" meta={`${history.length} recientes`} />
        {history.length === 0 ? <p className="pf-empty">Aún no hay asistencia registrada.</p> : (
          <ul className="pv-history">
            {history.map((a) => {
              const m = matchById.get(a.match_id);
              return (
                <li key={a.id}>
                  <span>{m ? formatMatchDate(m) : "Partido"}</span>
                  <span className={`pv-att is-${a.status}`}>{attendanceLabel(a.status, a.checked_in)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {privateOk && (
        <section className="pv-section pv-private" aria-labelledby="pv-private-title">
          <Head id="pv-private-title" title="Datos privados" meta={isSelf ? "Solo tú y la administración" : "Visible solo para administración"} icon={Shield} />
          <dl className="pv-dl">
            <div><dt>Nombre completo</dt><dd>{p.full_name || "—"}</dd></div>
            <div><dt>Teléfono</dt><dd>{p.phone || "Sin teléfono"}</dd></div>
            <div><dt>Tags de subgrupo</dt><dd>{(p.group_tags || []).length ? p.group_tags.map(formatTag).join(", ") : "Ninguno"}</dd></div>
          </dl>
          <h3 className="mdd-sub">Multas ({playerFines.length})</h3>
          {playerFines.length === 0 ? <p className="pf-empty">No hay multas.</p> : (
            <ul className="pv-history">
              {playerFines.map((f) => (
                <li key={f.id}>
                  <span>{fineReasonLabel(f.reason)} · {fineLabel(f.status)}</span>
                  <b>{formatMoney(f.amount)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {isAdmin && (
        <section className="pv-section pv-admin" aria-labelledby="pv-admin-title">
          <Head id="pv-admin-title" title="Administración" meta="Solo administradores" />
          <div className="pv-admin-inline">
            <button type="button" className={`md-btn ${p.membership_is_active ? "md-btn-ghost" : "md-btn-accent"}`} onClick={() => onUpdateMember(p.id, { is_active: !p.membership_is_active })}>
              {p.membership_is_active ? "Desactivar jugador" : "Activar jugador"}
            </button>
          </div>
          <div className="pl-field">
            <span>Posición preferida</span>
            <div className="pl-seg" role="group" aria-label="Posición preferida">
              {POSITION_OPTIONS.map((pos) => (
                <button key={pos} type="button" className={p.preferred_position === pos ? "is-on" : ""} aria-pressed={p.preferred_position === pos} onClick={() => onUpdateProfile(p.id, { preferred_position: pos })}>
                  {positionLabel(pos)}
                </button>
              ))}
            </div>
          </div>
          {isSuperAdmin && (
            <>
              <div className="pl-field">
                <span>Tags de subgrupo (separados por coma)</span>
                <div className="pv-admin-inline">
                  <input value={tagDraft} placeholder="martes, veteranos" onChange={(e) => setTagDraft(e.target.value)} />
                  <button type="button" className="md-btn md-btn-ghost" onClick={async () => {
                    const next = parseTags(tagDraft);
                    if (onCreateGroupTag) await Promise.all(next.map((t) => onCreateGroupTag(t)));
                    await onUpdateProfile(p.id, { group_tags: next });
                    setTagDraft(next.join(", "));
                  }}>Guardar tags</button>
                </div>
              </div>
              <div className="pl-field">
                <span>Estrellas por posición · {ratingMap.has(p.id) ? <PositionRatingDisplay ratings={ratingMap.get(p.id)} /> : "sin estrellas"}</span>
                <PositionRatingControl
                  ratings={ratingMap.get(p.id) || { attack_rating: 2, defense_rating: 2, midfield_rating: 2, goalkeeper_rating: 2 }}
                  onSelect={(key, level) => onAssignRating(p.id, key, level)}
                />
              </div>
              <div className="pl-field">
                <span>Capacidades (1–100) — se reflejan en la carta y el balanceo</span>
                <CapacityControl profileId={p.id} />
              </div>
            </>
          )}
          {!isSuperAdmin && <p className="pf-empty">Solo el Super Admin puede modificar estrellas, tags y habilidades.</p>}
        </section>
      )}
    </>
  );

  return (
    <div className={`pv pv-${variant}`} data-view="player" data-player={p.id}>
      <div className="mdd-topline">
        <button type="button" className={variant === "command" ? "md-btn md-btn-ghost md-btn-sm mdd-back" : "md-linkbtn mdd-back"} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Jugadores
        </button>
        {variant === "editorial" && <span className="mde-crumb">Perfil del jugador</span>}
      </div>
      {variant === "command" ? (
        <>
          <div className="pv-cc-hero">
            {card}
            <div className="pv-cc-hero-info">
              <PlayerIdentity profile={p} rating={ratingMap.get(p.id)} active={p.membership_is_active} variant="command" />
              <StatTiles stats={row} variant="command" compact />
            </div>
          </div>
          <div className="pv-cc-grid">{main}</div>
        </>
      ) : (
        <>
          <header className="pv-ed-hero">
            <div>
              <span className="pf-pos">{positionShort(p.preferred_position)} · {positionLabel(p.preferred_position || "Flexible")}</span>
              <h1>{displayName(p)}</h1>
              <p className="pf-meta">
                <PlayerBadge rating={ratingMap.get(p.id)} />
                <span className={`pf-status ${p.membership_is_active ? "is-on" : ""}`}>{p.membership_is_active ? "Activo" : "Inactivo"}</span>
              </p>
            </div>
            {card}
          </header>
          <div className="pv-ed-body">{main}</div>
        </>
      )}
    </div>
  );
}

/* ============================================================ Ranking */
export function PlayerRanking({ rows, variant, ratingMap, onOpen }) {
  const [sort, setSort] = useState("goals");
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("all");
  const data = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...rows]
      .filter(({ profile: p }) => p.membership_is_active)
      .filter(({ profile: p }) => (pos === "all" || p.preferred_position === pos) && (!query || `${p.full_name || ""} ${p.nickname || ""}`.toLowerCase().includes(query)))
      .sort(SORTERS[sort]);
  }, [rows, sort, q, pos]);
  const top = (key) => { const s = [...data].sort((a, b) => b[key] - a[key])[0]; return s && s[key] > 0 ? s : null; };
  const podium = [["Goleador", top("goals"), "goals", "goles"], ["Rey MVP", top("mvps"), "mvps", "MVP"], ["Asistidor", top("assists"), "assists", "asistencias"]].filter((x) => x[1]);
  const hasData = data.some((r) => r.statRows > 0 || r.confirmedAttendances > 0);
  const attendanceLeaders = [...data].sort((a, b) => b.confirmedAttendances - a.confirmedAttendances || b.reliabilityScore - a.reliabilityScore).slice(0, 5);
  const reliabilityLeaders = [...data].filter((r) => r.confirmedAttendances > 0 || r.canceledAttendances > 0 || r.noShows > 0)
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore || b.confirmedAttendances - a.confirmedAttendances).slice(0, 5);
  const cols = [["matches", "PJ", "matchesPlayed"], ["goals", "G", "goals"], ["assists", "A", "assists"], ["mvps", "MVP", "mvps"], ["cleanSheets", "VI", "cleanSheets"], ["votes", "Voto", "voteAverage"]];

  return (
    <div className={`rk rk-${variant}`} data-view="ranking">
      {!hasData ? (
        <p className="pf-empty">El ranking aparecerá cuando haya partidos con estadísticas o asistencias registradas.</p>
      ) : (
        <>
          {podium.length > 0 && (
            <section className="rk-podium" aria-label="Destacados del grupo">
              {podium.map(([label, row, key, unit], i) => (
                <button key={label} type="button" className={`rk-pod rk-pod-${i}`} onClick={() => onOpen(row.profile.id)}>
                  <span className="rk-pod-label">{i === 1 ? <Crown size={15} aria-hidden="true" /> : <Trophy size={15} aria-hidden="true" />}{label}</span>
                  <Avatar profile={row.profile} size="md" />
                  <b>{displayName(row.profile)}</b>
                  <span className="rk-pod-val"><strong>{row[key]}</strong> {unit}</span>
                </button>
              ))}
            </section>
          )}
          <div className="pl-controls" role="search">
            <label className="pl-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Buscar jugador" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en el ranking" />
            </label>
            <label className="pl-select"><span>Posición</span>
              <select value={pos} onChange={(e) => setPos(e.target.value)}>{POS_FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            </label>
            <label className="pl-select"><span>Ordenar por</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="goals">Goles</option><option value="assists">Asistencias</option><option value="mvps">MVP</option>
                <option value="cleanSheets">Vallas invictas</option><option value="votes">Voto promedio</option><option value="matches">Partidos</option>
              </select>
            </label>
          </div>
          <div className="rk-table-wrap">
            <table className="rk-table">
              <caption className="sr-only">Ranking de jugadores ordenado por {sort}</caption>
              <thead>
                <tr>
                  <th scope="col">#</th><th scope="col">Jugador</th><th scope="col">Pos</th>
                  {cols.map(([id, label]) => <th scope="col" key={id} className={sort === id ? "is-sort" : ""} aria-sort={sort === id ? "descending" : undefined}>{label}</th>)}
                  <th scope="col">Cump.</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={r.profile.id}>
                    <td className="rk-n">{i + 1}</td>
                    <td><button type="button" className="rk-player" onClick={() => onOpen(r.profile.id)}><Avatar profile={r.profile} size="sm" />{displayName(r.profile)}</button></td>
                    <td><span className="rk-pos">{positionShort(r.profile.preferred_position)}</span></td>
                    {cols.map(([id, , key]) => <td key={id} className={sort === id ? "is-sort" : ""}>{key === "voteAverage" ? (r.voteAverage > 0 ? r.voteAverage.toFixed(1) : "—") : r[key]}</td>)}
                    <td>{r.confirmedAttendances}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(attendanceLeaders.length > 0 || reliabilityLeaders.length > 0) && (
            <section className="rk-reliab" aria-label="Asistencia y confiabilidad">
              <div>
                <Head title="Más cumplidos" icon={variant === "command" ? Users : null} />
                <ol>{attendanceLeaders.map((r) => <li key={r.profile.id}><span>{displayName(r.profile)}</span><b>{r.confirmedAttendances}</b></li>)}</ol>
              </div>
              <div>
                <Head title="Confiabilidad" meta="confirmaciones − cancelaciones − 2 × ausencias" />
                <ol>{reliabilityLeaders.map((r) => <li key={r.profile.id}><span>{displayName(r.profile)}</span><b>{r.reliabilityScore}</b></li>)}</ol>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export { skillIdsOf };
