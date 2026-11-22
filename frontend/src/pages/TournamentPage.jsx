import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CalendarDays, Check, ChevronRight, Crown, Download, GitBranch, ListOrdered, MessageCircle,
  Pencil, PlusCircle, Share2, Shield, Trash2, Trophy, Users, Wand2, X,
} from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import { api } from "../api.js";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { Empty, Kpis, Section, StatusChip } from "../components/finance/FinanceBlocks.jsx";
import {
  FORMATS, bracketColumns, formGuide, formatLabel, groupRounds, isPlayoffMatch, teamColor, teamRating, tournamentStatusLabel,
} from "../tournament/tournamentModel.js";
import {
  FORMAT_RULES, allowedTeamCounts, canEditResult, championOf, computeStandings, generateChampionshipFixtures,
  isKnockout, isPlayed, knockoutUpdates, leagueComplete, nextStep, restingTeams, slotSources, tiedOnRule,
  validateScore, weekdayOf, winnerOf,
} from "../tournament/championship.js";
import {
  championText, renderShareImage, roundImageData, roundText, standingsImageData, standingsText,
} from "../tournament/share.js";
import { copyToClipboard, displayName, waUrl } from "../utils.js";

const STATUS_TONE = { draft: "forgiven", active: "paid", finished: "review" };
const WEEKDAY_ES = { monday: "lunes", tuesday: "martes", wednesday: "miércoles", thursday: "jueves", friday: "viernes", saturday: "sábados", sunday: "domingos" };
const shortDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" }) : "Fecha pendiente");
const QUALIFY = { cuadrangular: { n: 2, label: "Final" }, league_playoffs: { n: 4, label: "Semifinales" } };

/* ---------- Create: one short form ---------- */
function TournamentForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", format: "league", team_count: 4, start_date: "", match_time: "19:00", venue: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (p) => setForm((f) => ({ ...f, ...p }));
  const counts = allowedTeamCounts(form.format);

  function pickFormat(format) {
    const allowed = allowedTeamCounts(format);
    update({ format, team_count: allowed.includes(form.team_count) ? form.team_count : allowed.includes(4) ? 4 : allowed[0] });
  }

  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.name.trim()) { setError("Poné el nombre del campeonato."); return; }
    if (!form.start_date) { setError("Elegí la fecha del primer partido."); return; }
    setBusy(true);
    try { await onSave({ ...form, name: form.name.trim(), venue: form.venue.trim() || null, match_day: weekdayOf(form.start_date) }); }
    catch (err) { setError(err?.message || "No se pudo crear el campeonato."); }
    finally { setBusy(false); }
  }

  const day = weekdayOf(form.start_date);
  return (
    <form className="form-grid md-form fx-form fx-create tn-create" onSubmit={submit} aria-label="Nuevo campeonato">
      {error && <p className="form-message" role="alert">{error}</p>}
      <label className="md-form-wide">Nombre
        <input placeholder="Ej. Copa de los jueves" value={form.name} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <fieldset className="md-form-group tn-formats md-form-wide">
        <legend>Formato</legend>
        {FORMATS.map((f) => (
          <label key={f.id} className={`tn-format ${form.format === f.id ? "is-on" : ""}`}>
            <input type="radio" name="tn-format" value={f.id} checked={form.format === f.id} onChange={() => pickFormat(f.id)} />
            <b>{f.label}</b><small>{f.desc}</small><small className="tn-format-size">{FORMAT_RULES[f.id].label}</small>
          </label>
        ))}
      </fieldset>
      <label>Cantidad de equipos
        <select value={form.team_count} onChange={(e) => update({ team_count: Number(e.target.value) })} disabled={counts.length === 1}>
          {counts.map((n) => <option key={n} value={n}>{n} equipos</option>)}
        </select>
      </label>
      <label>Primer partido
        <input type="date" value={form.start_date} onChange={(e) => update({ start_date: e.target.value })} />
        <small className="fx-hint">{day ? `Se juega los ${WEEKDAY_ES[day]}, una fecha por semana.` : "Después se juega cada semana el mismo día."}</small>
      </label>
      <label>Hora
        <input type="time" value={form.match_time} onChange={(e) => update({ match_time: e.target.value })} />
      </label>
      <label>Cancha <small>(opcional)</small>
        <input placeholder="Ej. Plaza 3" value={form.venue} onChange={(e) => update({ venue: e.target.value })} />
      </label>
      <div className="md-form-actions md-form-wide">
        <button className="md-btn md-btn-ghost" type="button" onClick={onCancel}>Cancelar</button>
        <button className="md-btn md-btn-accent" type="submit" disabled={busy}>{busy ? "Creando…" : "Siguiente: equipos"}</button>
      </div>
    </form>
  );
}

/* ---------- Teams: names required, players optional, then calendar in one go ---------- */
function TeamSetup({ tournament, teamCount, profiles, ratingMap, onSave }) {
  const [teamNames, setTeamNames] = useState(() => Array.from({ length: teamCount }, (_, i) => `Equipo ${String.fromCharCode(65 + i)}`));
  const [assignments, setAssignments] = useState({});
  const [showPlayers, setShowPlayers] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activePlayers = profiles.filter((p) => p.membership_is_active);
  const assignedIds = new Set(Object.values(assignments).flat());
  const unassigned = activePlayers.filter((p) => !assignedIds.has(p.id));

  const setName = (i, v) => setTeamNames((p) => p.map((n, k) => (k === i ? v : n)));
  const counts = allowedTeamCounts(tournament.format);
  function setCount(n) {
    setTeamNames((p) => Array.from({ length: n }, (_, i) => p[i] ?? `Equipo ${String.fromCharCode(65 + i)}`));
    setAssignments((p) => Object.fromEntries(Object.entries(p).filter(([k]) => Number(k) < n)));
  }
  const assign = (ti, pid) => setAssignments((p) => {
    const next = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.filter((id) => id !== pid)]));
    next[ti] = [...(next[ti] || []), pid];
    return next;
  });
  const unassign = (pid) => setAssignments((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.filter((id) => id !== pid)])));
  function autoBalance() {
    const sorted = [...activePlayers].sort((a, b) => (ratingMap.get(b.id)?.rating || 2) - (ratingMap.get(a.id)?.rating || 2));
    const next = Object.fromEntries(teamNames.map((_, i) => [i, []]));
    sorted.forEach((p, i) => { next[i % teamNames.length].push(p.id); });
    setAssignments(next); setShowPlayers(true);
  }

  async function finish() {
    setError("");
    const names = teamNames.map((n) => n.trim());
    if (names.some((n) => !n)) { setError("Cada equipo necesita un nombre."); return; }
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) { setError("Hay dos equipos con el mismo nombre."); return; }
    setBusy(true);
    try { await onSave(names, assignments); }
    catch (err) { setError(err?.message || "No se pudieron crear los equipos."); setBusy(false); }
  }

  return (
    <Section title="Equipos" icon={Users} className="tn-setup">
      <ol className="tn-steps" aria-label="Progreso">
        <li className="is-done">Campeonato</li><li className="is-now">Equipos</li><li>Calendario</li>
      </ol>
      <div className="tn-setup-head">
        <label>Cantidad de equipos
          <select value={teamNames.length} onChange={(e) => setCount(Number(e.target.value))} disabled={counts.length === 1}>
            {counts.map((n) => <option key={n} value={n}>{n} equipos</option>)}
          </select>
        </label>
        <p className="fx-hint">{formatLabel(tournament.format)}. Los jugadores son opcionales: podés asignarlos ahora o después desde «Equipos».</p>
      </div>
      {error && <p className="fx-alert is-bad" role="alert">{error}</p>}
      <ul className="tn-name-list">
        {teamNames.map((name, i) => (
          <li key={i} style={{ "--tn-team": teamColor(i) }}>
            <span className="tn-swatch" aria-hidden="true" />
            <input type="text" aria-label={`Nombre del equipo ${i + 1}`} value={name} maxLength={40} onChange={(e) => setName(i, e.target.value)} />
          </li>
        ))}
      </ul>
      <div className="tn-setup-actions">
        <button className="md-btn md-btn-ghost" type="button" onClick={() => setShowPlayers((v) => !v)} aria-expanded={showPlayers}>
          <Users size={15} aria-hidden="true" /> {showPlayers ? "Ocultar jugadores" : "Asignar jugadores (opcional)"}
        </button>
        {activePlayers.length > 0 && <button className="md-btn md-btn-ghost" type="button" onClick={autoBalance}><Wand2 size={15} aria-hidden="true" /> Repartir parejo</button>}
      </div>
      {showPlayers && (
        <>
          <p className="fx-hint">{unassigned.length} jugadores sin equipo.</p>
          <div className="tn-assign-grid">
            {teamNames.map((name, i) => {
              const members = assignments[i] || [];
              return (
                <article key={i} className="tn-assign" style={{ "--tn-team": teamColor(i) }}>
                  <header><b>{name || `Equipo ${i + 1}`}</b><small>{members.length} jug · {teamRating(members, ratingMap)} ★</small></header>
                  <ul>
                    {members.map((pid) => {
                      const player = profiles.find((p) => p.id === pid);
                      return (
                        <li key={pid}>
                          <span><Avatar profile={player} size="sm" />{displayName(player)}</span>
                          <button className="md-icon-btn" type="button" aria-label={`Quitar a ${displayName(player)}`} onClick={() => unassign(pid)}><X size={15} aria-hidden="true" /></button>
                        </li>
                      );
                    })}
                  </ul>
                  <select className="rv-select" value="" aria-label={`Agregar jugador a ${name}`} onChange={(e) => { if (e.target.value) assign(i, e.target.value); }}>
                    <option value="">+ Agregar jugador</option>
                    {unassigned.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
                  </select>
                </article>
              );
            })}
          </div>
        </>
      )}
      <div className="md-form-actions">
        <button className="md-btn md-btn-accent" type="button" onClick={finish} disabled={busy}>
          <CalendarDays size={15} aria-hidden="true" /> {busy ? "Armando calendario…" : "Crear equipos y calendario"}
        </button>
      </div>
    </Section>
  );
}

function TeamBadge({ team, index, placeholder, align = "start" }) {
  return (
    <span className={`tn-team is-${align}${team ? "" : " is-tbd"}`} style={{ "--tn-team": team ? teamColor(index) : "transparent" }}>
      <i aria-hidden="true" />{team?.name || placeholder || "Por definir"}
    </span>
  );
}

function ScoreEditor({ match, knockout, onSave, onCancel }) {
  const [home, setHome] = useState(match.home_score ?? "");
  const [away, setAway] = useState(match.away_score ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  async function save(e) {
    e?.preventDefault();
    const v = validateScore(home, away, knockout);
    if (!v.ok) { setError(v.error); return; }
    setBusy(true); setError("");
    const err = await onSave(v.home, v.away);
    if (err) { setError(err); setBusy(false); }
  }
  return (
    <form className="tn-score-edit" onSubmit={save} aria-label="Cargar resultado">
      <span className="tn-score-inputs">
        <input ref={firstRef} type="number" min="0" max="99" inputMode="numeric" aria-label="Goles local" value={home} onChange={(e) => setHome(e.target.value)} placeholder="0" />
        <span aria-hidden="true">–</span>
        <input type="number" min="0" max="99" inputMode="numeric" aria-label="Goles visitante" value={away} onChange={(e) => setAway(e.target.value)} placeholder="0" />
      </span>
      <span className="tn-score-btns">
        <button className="md-btn md-btn-accent fx-btn-sm" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
        <button className="fx-icon is-reject" type="button" aria-label="Cancelar" onClick={onCancel} disabled={busy}><X size={15} aria-hidden="true" /></button>
      </span>
      {error && <small className="tn-score-err" role="alert">{error}</small>}
    </form>
  );
}

function roundHeading(g, matches) {
  if (!g.playoff) return `Jornada ${g.round}`;
  return bracketColumns(matches).find((c) => c.round === g.round)?.title || `Ronda ${g.round}`;
}

function FixturesView({ variant, tournament, matches, teams, canManage, onSaveResult }) {
  const [editingId, setEditingId] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const teamIndex = useMemo(() => new Map(teams.map((t, i) => [t.id, i])), [teams]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const rounds = useMemo(() => groupRounds(matches), [matches]);
  const sources = useMemo(() => slotSources(tournament.format, matches), [tournament.format, matches]);
  const finished = tournament.status === "finished";

  return (
    <div className={`tn-rounds is-${variant}`}>
      {rounds.map((g) => {
        const title = roundHeading(g, matches);
        const rest = restingTeams(teams, g.matches);
        return (
          <section key={g.round} className="tn-round" aria-label={title}>
            <header className="tn-round-head">
              <h3>{title}</h3>
              <small>{shortDate(g.date)}{g.matches[0]?.match_time ? ` · ${g.matches[0].match_time}` : ""} · {g.played}/{g.matches.length} jugados</small>
              {g.playoff && <StatusChip tone="review">Eliminatoria</StatusChip>}
            </header>
            <ul className="tn-fixtures">
              {g.matches.map((m) => {
                const home = teamMap.get(m.home_team_id); const away = teamMap.get(m.away_team_id);
                const winner = winnerOf(m);
                const src = sources.get(m.id) || [];
                const edit = canEditResult(tournament.format, m, matches);
                const played = isPlayed(m);
                return (
                  <li key={m.id} className={`tn-fixture ${played ? "is-played" : ""}${editingId === m.id ? " is-editing" : ""}`} data-match={m.id}>
                    <span className={`tn-side is-home ${winner && winner === m.home_team_id ? "is-win" : ""}`}><TeamBadge team={home} index={teamIndex.get(m.home_team_id) ?? 0} placeholder={src[0]} align="end" /></span>
                    <span className="tn-mid">
                      {editingId === m.id ? (
                        <ScoreEditor match={m} knockout={isKnockout(m)} onCancel={() => setEditingId(null)}
                          onSave={async (h, a) => { const err = await onSaveResult(m, h, a); if (!err) setEditingId(null); return err; }} />
                      ) : played ? (
                        <b className="tn-score" aria-label={`Resultado ${m.home_score} a ${m.away_score}`}>{m.home_score}<i>–</i>{m.away_score}</b>
                      ) : (
                        <span className="tn-vs" aria-hidden="true">vs</span>
                      )}
                      {canManage && !finished && editingId !== m.id && (
                        edit.ok ? (
                          <button className={`md-btn ${played ? "md-btn-ghost" : "md-btn-accent"} fx-btn-sm`} type="button"
                            aria-label={`${played ? "Corregir" : "Cargar"} resultado ${home?.name || ""} vs ${away?.name || ""}`}
                            onClick={() => { setBlocked(null); setEditingId(m.id); }}>
                            {played ? <><Pencil size={13} aria-hidden="true" /> Corregir</> : "Cargar resultado"}
                          </button>
                        ) : played ? (
                          <button className="md-linkbtn tn-locked" type="button" onClick={() => setBlocked(blocked === m.id ? null : m.id)} aria-expanded={blocked === m.id}>Bloqueado</button>
                        ) : null
                      )}
                      {blocked === m.id && <small className="tn-score-err" role="status">{edit.reason}</small>}
                      {m.playoff_label && <small>{m.playoff_label}</small>}
                    </span>
                    <span className={`tn-side is-away ${winner && winner === m.away_team_id ? "is-win" : ""}`}><TeamBadge team={away} index={teamIndex.get(m.away_team_id) ?? 1} placeholder={src[1]} /></span>
                  </li>
                );
              })}
            </ul>
            {rest.length > 0 && <p className="tn-rest">Descansa: {rest.map((t) => t.name).join(", ")}</p>}
          </section>
        );
      })}
    </div>
  );
}

function StandingsTable({ variant, tournament, teams, matches }) {
  const table = useMemo(() => computeStandings(teams, matches), [teams, matches]);
  const teamIndex = new Map(teams.map((t, i) => [t.id, i]));
  const maxPts = Math.max(1, ...table.map((s) => s.points || 0));
  const q = QUALIFY[tournament.format];
  const cutTie = q && tiedOnRule(table[q.n - 1], table[q.n]);
  return (
    <>
      <div className="tn-table-wrap" tabIndex={0} role="region" aria-label="Tabla de posiciones (desplazable)">
        <table className={`fx-table tn-table is-${variant}`}>
          <caption className="sr-only">Tabla de posiciones</caption>
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col">Equipo</th>
              <th scope="col" className="num" title="Partidos jugados">PJ</th><th scope="col" className="num" title="Ganados">G</th>
              <th scope="col" className="num" title="Empatados">E</th><th scope="col" className="num" title="Perdidos">P</th>
              <th scope="col" className="num tn-hide-sm" title="Goles a favor">GF</th><th scope="col" className="num tn-hide-sm" title="Goles en contra">GC</th>
              <th scope="col" className="num" title="Diferencia de gol">DG</th>
              <th scope="col" className="tn-hide-sm">Forma</th>
              <th scope="col" className="num">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((s, i) => {
              const team = teams.find((t) => t.id === s.tournament_team_id);
              const dg = s.goal_diff;
              return (
                <tr key={s.tournament_team_id} className={`${i === 0 ? "is-leader" : ""}${q && i < q.n ? " is-qualified" : ""}${q && i === q.n - 1 ? " is-cut" : ""}`}>
                  <td className="tn-pos">{i + 1}</td>
                  <td><TeamBadge team={team} index={teamIndex.get(s.tournament_team_id) ?? i} /></td>
                  <td className="num">{s.played}</td><td className="num">{s.won}</td>
                  <td className="num">{s.drawn}</td><td className="num">{s.lost}</td>
                  <td className="num tn-hide-sm">{s.goals_for}</td><td className="num tn-hide-sm">{s.goals_against}</td>
                  <td className="num">{dg > 0 ? `+${dg}` : dg}</td>
                  <td className="tn-hide-sm"><span className="tn-form" aria-label="Últimos resultados">{formGuide(matches.filter((m) => !isKnockout(m)), s.tournament_team_id).map((r, k) => <i key={k} className={`is-${r}`}>{r}</i>)}</span></td>
                  <td className="num tn-pts">
                    <b>{s.points}</b>
                    {variant === "command" && <span className="fx-meter is-accent tn-pts-bar" aria-hidden="true"><i style={{ inlineSize: `${((s.points || 0) / maxPts) * 100}%` }} /></span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fx-hint tn-legend">
        Orden: puntos, diferencia de gol, goles a favor y enfrentamiento directo.
        {q && <> Los primeros {q.n} pasan a {q.label}.</>}
        {cutTie && <b className="tn-warn"> Hay un empate total en la línea de clasificación: se ordena por inscripción hasta que lo definan.</b>}
      </p>
    </>
  );
}

function Bracket({ variant, tournament, matches, teams }) {
  const cols = bracketColumns(matches);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const teamIndex = new Map(teams.map((t, i) => [t.id, i]));
  const sources = slotSources(tournament.format, matches);
  if (cols.length === 0) return <Empty>Este formato no tiene eliminatorias.</Empty>;
  return (
    <div className={`tn-bracket is-${variant}`} role="list" aria-label="Llaves eliminatorias">
      {cols.map((c) => (
        <section key={c.round} className="tn-col" role="listitem" aria-label={c.title}>
          <h3>{c.title}</h3>
          <div className="tn-col-matches">
            {c.matches.map((m) => {
              const w = winnerOf(m); const src = sources.get(m.id) || [];
              const row = (id, score, slot) => (
                <div className={`tn-slot ${w && w === id ? "is-win" : ""} ${w && id && w !== id ? "is-out" : ""}`}>
                  <TeamBadge team={teamMap.get(id)} index={teamIndex.get(id) ?? 0} placeholder={src[slot]} />
                  <b>{isPlayed(m) ? score : ""}</b>
                </div>
              );
              return (
                <article key={m.id} className="tn-tie">
                  {m.playoff_label && <small>{m.playoff_label} · {shortDate(m.match_date)}</small>}
                  {row(m.home_team_id, m.home_score, 0)}
                  {row(m.away_team_id, m.away_score, 1)}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function TeamsGrid({ variant, teams, teamMembers, profiles, ratingMap, canManage, onAddMember, onRemoveMember }) {
  const assigned = new Set(teamMembers.map((m) => m.profile_id));
  const free = profiles.filter((p) => p.membership_is_active && !assigned.has(p.id));
  return (
    <div className={`tn-teams is-${variant}`}>
      {teams.map((team, i) => {
        const members = teamMembers.filter((m) => m.tournament_team_id === team.id);
        return (
          <article className="tn-team-card" key={team.id} style={{ "--tn-team": teamColor(i) }}>
            <header>
              <TeamBadge team={team} index={i} />
              <small>{members.length} jug{members.length ? ` · ${teamRating(members.map((m) => m.profile_id), ratingMap)} ★` : ""}</small>
            </header>
            {members.length === 0 && <p className="fx-hint">Sin jugadores asignados.</p>}
            <ul>
              {members.map((m) => {
                const player = m.profiles || profiles.find((p) => p.id === m.profile_id);
                return (
                  <li key={m.id}>
                    <span><Avatar profile={player} size="sm" />{displayName(player)}</span>
                    {canManage && <button className="md-icon-btn" type="button" aria-label={`Quitar a ${displayName(player)} de ${team.name}`} onClick={() => onRemoveMember(m.id)}><X size={15} aria-hidden="true" /></button>}
                  </li>
                );
              })}
            </ul>
            {canManage && free.length > 0 && (
              <select className="rv-select" value="" aria-label={`Agregar jugador a ${team.name}`} onChange={(e) => { if (e.target.value) onAddMember(team.id, e.target.value); }}>
                <option value="">+ Agregar jugador</option>
                {free.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
              </select>
            )}
          </article>
        );
      })}
    </div>
  );
}

function SharePanel({ tournament, teams, matches, champion }) {
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const sources = useMemo(() => slotSources(tournament.format, matches), [tournament.format, matches]);
  const rounds = useMemo(() => groupRounds(matches), [matches]);
  const nextRound = rounds.find((g) => g.played < g.matches.length) || rounds.at(-1);
  const lastPlayed = [...rounds].reverse().find((g) => g.played > 0);
  const hasTable = tournament.format !== "playoffs_only";
  const teamName = (id) => teams.find((t) => t.id === id)?.name;
  const items = [
    champion?.status === "decided" && { id: "champ", label: "Campeón", text: championText(tournament, teamName(champion.teamId), teamName(champion.runnerUpId)) },
    hasTable && { id: "table", label: "Tabla de posiciones", text: standingsText(tournament, teams, matches), image: () => standingsImageData(tournament, teams, matches) },
    nextRound && { id: "next", label: `Próxima fecha · ${roundHeading(nextRound, matches)}`, text: roundText(tournament, teams, matches, nextRound.round, sources), image: () => roundImageData(tournament, teams, matches, nextRound.round, sources) },
    lastPlayed && lastPlayed !== nextRound && { id: "last", label: `Resultados · ${roundHeading(lastPlayed, matches)}`, text: roundText(tournament, teams, matches, lastPlayed.round, sources), image: () => roundImageData(tournament, teams, matches, lastPlayed.round, sources) },
  ].filter(Boolean);

  async function copy(it) { await copyToClipboard(it.text); setCopied(it.id); window.setTimeout(() => setCopied(""), 1600); }
  async function image(it) {
    setBusy(true); setMsg("");
    try {
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue("--md-accent").trim() || "#5be584";
      const dark = !document.documentElement.matches("[data-f5-palette=light]");
      const blob = await renderShareImage({ ...it.image(), accent, dark });
      const file = new File([blob], `${tournament.name.replace(/[^\w-]+/g, "-").toLowerCase()}-${it.id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: tournament.name }); }
      else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        setMsg("Imagen descargada. Adjuntala en WhatsApp.");
      }
    } catch (err) { if (err?.name !== "AbortError") setMsg("No se pudo crear la imagen en este dispositivo."); }
    finally { setBusy(false); }
  }

  if (!items.length) return <Empty>Generá el calendario para poder compartir.</Empty>;
  return (
    <div className="tn-share">
      {msg && <p className="fx-hint" role="status">{msg}</p>}
      {items.map((it) => (
        <article key={it.id} className="tn-share-item" data-share={it.id}>
          <header><b>{it.label}</b>{copied === it.id && <StatusChip tone="paid">Copiado</StatusChip>}</header>
          <pre className="tn-share-text">{it.text}</pre>
          <div className="tn-share-actions">
            <a className="md-btn md-btn-accent fx-btn-sm" href={waUrl(it.text)} target="_blank" rel="noreferrer"><MessageCircle size={15} aria-hidden="true" /> WhatsApp</a>
            <button className="md-btn md-btn-ghost fx-btn-sm" type="button" onClick={() => copy(it)}>Copiar texto</button>
            {it.image && <button className="md-btn md-btn-ghost fx-btn-sm" type="button" onClick={() => image(it)} disabled={busy}><Download size={15} aria-hidden="true" /> Imagen</button>}
          </div>
        </article>
      ))}
    </div>
  );
}

function ChampionBanner({ variant, tournament, teams, champion, canManage, onFinish }) {
  const [busy, setBusy] = useState(false);
  if (champion.status === "tie") {
    return <p className="fx-alert is-warn tn-champ-tie" role="status">La liga terminó empatada en todos los criterios entre {champion.teamIds.map((id) => teams.find((t) => t.id === id)?.name).join(" y ")}. Definan el campeón (por ejemplo, con un partido extra) antes de cerrar.</p>;
  }
  if (champion.status !== "decided") return null;
  const champ = teams.find((t) => t.id === champion.teamId); const runner = teams.find((t) => t.id === champion.runnerUpId);
  const done = tournament.status === "finished";
  return (
    <section className={`tn-champion is-${variant}${done ? " is-final" : ""}`} aria-label="Campeón" data-champion={champ?.name}>
      <span className="tn-champion-ico" aria-hidden="true"><Crown size={28} /></span>
      <div>
        <small>{done ? "Campeón" : "Campeón definido"}</small>
        <b>{champ?.name}</b>
        {runner && <span>Subcampeón: {runner.name}</span>}
      </div>
      {canManage && !done && (
        <button className="md-btn md-btn-accent" type="button" disabled={busy} onClick={async () => { setBusy(true); await onFinish(); setBusy(false); }}>
          <Trophy size={15} aria-hidden="true" /> {busy ? "Cerrando…" : "Declarar campeón y finalizar"}
        </button>
      )}
    </section>
  );
}

export default function TournamentPage({ activeGroupId, profiles, ratingMap, isAdmin, isSuperAdmin, isDemoMode = false }) {
  const canManage = Boolean(isAdmin || isSuperAdmin);
  const [tournaments, setTournaments] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standingRows, setStandingRows] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamCounts, setTeamCounts] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("fixtures");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";
  const selected = tournaments.find((t) => t.id === selectedId);

  useEffect(() => {
    if (import.meta.env.DEV && isDemoMode) {
      import("../dev/tournamentDemo.js").then((d) => { setTournaments(d.demoTournaments(profiles)); setListLoaded(true); });
      return;
    }
    if (!activeGroupId || isDemoMode) return;
    setListLoaded(false);
    api.listTournaments(activeGroupId).then(setTournaments).catch(() => { setTournaments([]); setError("No se pudieron cargar los campeonatos."); }).finally(() => setListLoaded(true));
  }, [activeGroupId, isDemoMode]);

  async function loadDetail(id) {
    const [t, m, s, tm] = await Promise.all([
      api.listTournamentTeams(id), api.listTournamentMatches(id), api.listStandings(id), api.listAllTournamentTeamMembers(id),
    ]);
    setTeams(t); setMatches(m); setStandingRows(s); setTeamMembers(tm);
  }

  useEffect(() => {
    if (import.meta.env.DEV && isDemoMode && selectedId) {
      import("../dev/tournamentDemo.js").then((d) => {
        const t = d.demoTournamentDetail(selectedId, profiles);
        setTeams(t.teams); setMatches(t.matches); setStandingRows(t.standings); setTeamMembers(t.members);
      });
      return;
    }
    if (!selectedId || isDemoMode) { setTeams([]); setMatches([]); setStandingRows([]); setTeamMembers([]); return; }
    setLoading(true); setError("");
    loadDetail(selectedId)
      .catch(() => { setTeams([]); setMatches([]); setStandingRows([]); setTeamMembers([]); setError("No se pudo cargar el campeonato. Probá de nuevo."); })
      .finally(() => setLoading(false));
  }, [selectedId, isDemoMode]);

  function open(id) { setSelectedId(id); setTab("fixtures"); setError(""); setNotice(""); setConfirmDelete(false); }

  async function createTournament(form) {
    const { team_count, ...rest } = form;
    const col = await api.createTournament({ ...rest, group_id: activeGroupId, status: "draft" });
    setTournaments((c) => [col, ...c]);
    setTeamCounts((c) => ({ ...c, [col.id]: team_count }));
    setShowForm(false);
    open(col.id);
  }

  async function writeDerived(format, tms, ms, rows) {
    // Standings rows mirror the table derived from the matches (corrections never double count).
    const table = computeStandings(tms, ms);
    for (const r of rows) {
      const want = table.find((x) => x.tournament_team_id === r.tournament_team_id);
      if (!want) continue;
      const keys = ["played", "won", "drawn", "lost", "goals_for", "goals_against", "points"];
      if (keys.some((k) => Number(r[k]) !== want[k])) {
        await api.updateStanding(r.id, Object.fromEntries(keys.map((k) => [k, want[k]])));
      }
    }
    for (const u of knockoutUpdates(format, tms, ms)) {
      await api.updateTournamentMatch(u.id, { home_team_id: u.home_team_id, away_team_id: u.away_team_id });
    }
  }

  async function saveTeamsAndCalendar(teamNames, assignments) {
    setError("");
    const created = await api.createTournamentTeams(selectedId, teamNames.map((name, i) => ({ tournament_id: selectedId, name, team_order: i + 1 })));
    const ordered = [...created].sort((a, b) => a.team_order - b.team_order);
    for (let i = 0; i < ordered.length; i += 1) {
      const members = assignments[i] || [];
      if (members.length) await api.addTournamentTeamMembers(ordered[i].id, members);
    }
    await generateCalendar(ordered);
  }

  async function generateCalendar(teamList = teams) {
    setError("");
    try {
      const fixtures = generateChampionshipFixtures({
        format: selected.format, teams: teamList, startDate: selected.start_date,
        matchDay: selected.match_day || weekdayOf(selected.start_date), matchTime: selected.match_time, venue: selected.venue,
      });
      await api.createTournamentMatches(fixtures.map((f) => ({ ...f, tournament_id: selectedId })));
      await api.initStandings(selectedId, teamList.map((t) => t.id));
      if (selected.status === "draft") {
        await api.updateTournament(selectedId, { status: "active" });
        setTournaments((c) => c.map((t) => (t.id === selectedId ? { ...t, status: "active" } : t)));
      }
      await loadDetail(selectedId);
      setNotice("Calendario listo. Cargá los resultados a medida que se jueguen.");
    } catch (err) {
      setError(err?.message || "No se pudo generar el calendario.");
      await loadDetail(selectedId).catch(() => {});
      throw err;
    }
  }

  async function saveResult(match, home, away) {
    setError(""); setNotice("");
    const check = canEditResult(selected.format, match, matches);
    if (!check.ok) return check.reason;
    try {
      await api.updateTournamentMatch(match.id, { home_score: home, away_score: away, status: "played" });
      const next = matches.map((m) => (m.id === match.id ? { ...m, home_score: home, away_score: away, status: "played" } : m));
      await writeDerived(selected.format, teams, next, standingRows);
      await loadDetail(selectedId);
      const wasLeague = !isKnockout(match);
      if (wasLeague && leagueComplete(next) && QUALIFY[selected.format]) setNotice("Terminó la fase de liga: la eliminatoria ya tiene equipos.");
      return null;
    } catch (err) {
      await loadDetail(selectedId).catch(() => {});
      return err?.message || "No se pudo guardar el resultado.";
    }
  }

  async function finish() {
    setError("");
    try {
      const row = await api.updateTournament(selectedId, { status: "finished" });
      setTournaments((c) => c.map((t) => (t.id === selectedId ? { ...t, ...row, status: "finished" } : t)));
      setNotice("Campeonato finalizado.");
    } catch (err) { setError(err?.message || "No se pudo finalizar."); }
  }

  async function removeTournament() {
    setError("");
    try {
      await api.deleteTournament(selectedId);
      setTournaments((c) => c.filter((t) => t.id !== selectedId));
      setSelectedId(null);
    } catch (err) { setError(err?.message || "No se pudo eliminar."); }
  }

  async function addMember(teamId, profileId) {
    try { await api.addTournamentTeamMembers(teamId, [profileId]); setTeamMembers(await api.listAllTournamentTeamMembers(selectedId)); }
    catch (err) { setError(err?.message || "No se pudo agregar el jugador."); }
  }
  async function removeMember(memberId) {
    try { await api.removeTournamentTeamMember(memberId); setTeamMembers(await api.listAllTournamentTeamMembers(selectedId)); }
    catch (err) { setError(err?.message || "No se pudo quitar el jugador."); }
  }

  const shellClass = variant === "command" ? "mdc fx-shell" : "mde fx-shell";
  const wrap = (children, view = "tournaments") => (
    <div className={`md-matches md-design-${variant} fx-page tn-page`} data-design={variant} data-view={view}>
      <div className={shellClass}>{children}</div>
    </div>
  );

  /* ---------- List ---------- */
  if (!selected) {
    const active = tournaments.filter((t) => t.status === "active").length;
    return wrap(
      <>
        {variant === "command" ? (
          <div className="mdc-bar">
            <h1>Torneos</h1>
            <span className="mdc-pill"><Trophy size={14} aria-hidden="true" /> <b>{tournaments.length}</b> campeonatos</span>
            <span className="mdc-pill"><b>{active}</b> en juego</span>
          </div>
        ) : (
          <header className="fx-ed-hero">
            <span className="mde-crumb">Campeonatos entre amigos</span>
            <h1>Torneos</h1>
            <p className="fx-ed-lede"><b className="fx-lede-num">{tournaments.length}</b> campeonatos · <b className="fx-lede-num">{active}</b> en juego</p>
          </header>
        )}
        {error && <p className="fx-alert is-bad" role="alert">{error}</p>}
        <Section
          title="Campeonatos del grupo"
          icon={Trophy}
          aside={canManage ? <button className={`md-btn ${showForm ? "md-btn-ghost" : "md-btn-accent"}`} type="button" onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : <><PlusCircle size={15} aria-hidden="true" /> Nuevo campeonato</>}</button> : null}
        >
          {showForm && <TournamentForm onSave={createTournament} onCancel={() => setShowForm(false)} />}
          {!listLoaded && !isDemoMode && <p className="fx-hint" role="status">Cargando campeonatos…</p>}
          {listLoaded && tournaments.length === 0 && !showForm && (
            canManage ? (
              <div className="tn-empty">
                <b>Armá tu primer campeonato</b>
                <ol><li>Elegí formato y fecha.</li><li>Nombrá los equipos.</li><li>El calendario se arma solo.</li></ol>
                <button className="md-btn md-btn-accent" type="button" onClick={() => setShowForm(true)}><PlusCircle size={15} aria-hidden="true" /> Nuevo campeonato</button>
              </div>
            ) : <Empty>Tu grupo todavía no tiene campeonatos. Cuando el organizador cree uno, vas a ver acá el calendario y la tabla.</Empty>
          )}
          <ul className={`tn-list is-${variant}`}>
            {tournaments.map((t, i) => (
              <li key={t.id}>
                <button type="button" className="tn-list-item" onClick={() => open(t.id)}>
                  {variant === "editorial" && <span className="tn-list-n">{String(i + 1).padStart(2, "0")}</span>}
                  {variant === "command" && <span className="tn-list-ico"><Trophy size={20} aria-hidden="true" /></span>}
                  <span className="tn-list-main">
                    <b>{t.name}</b>
                    <small>{formatLabel(t.format)} · {t.start_date ? shortDate(t.start_date) : "Sin fecha"}{t.venue ? ` · ${t.venue}` : ""}</small>
                  </span>
                  <StatusChip tone={STATUS_TONE[t.status] || "forgiven"}>{tournamentStatusLabel(t.status)}</StatusChip>
                  <ChevronRight size={18} aria-hidden="true" className="tn-go" />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </>,
    );
  }

  /* ---------- Detail ---------- */
  const hasTeams = teams.length > 0;
  const hasMatches = matches.length > 0;
  const hasBracket = matches.some(isPlayoffMatch);
  const hasTable = selected.format !== "playoffs_only";
  const played = matches.filter(isPlayed).length;
  const goals = matches.filter(isPlayed).reduce((s, m) => s + Number(m.home_score) + Number(m.away_score), 0);
  const champion = championOf(selected.format, teams, matches);
  const leader = hasTable ? computeStandings(teams, matches)[0] : null;
  const teamCount = teamCounts[selected.id] || allowedTeamCounts(selected.format).find((n) => n >= 4) || allowedTeamCounts(selected.format)[0];
  const tabs = [
    ["fixtures", "Calendario", CalendarDays],
    ...(hasTable ? [["standings", "Tabla", ListOrdered]] : []),
    ...(hasBracket ? [["bracket", "Llaves", GitBranch]] : []),
    ["teams", "Equipos", Shield],
    ["share", "Compartir", Share2],
  ];

  return wrap(
    <>
      <button className="mdd-back md-btn md-btn-ghost tn-back" type="button" onClick={() => setSelectedId(null)}><ArrowLeft size={16} aria-hidden="true" /> Campeonatos</button>
      {variant === "command" ? (
        <div className="mdc-bar">
          <h1>{selected.name}</h1>
          <span className="mdc-pill">{formatLabel(selected.format)}</span>
          <StatusChip tone={STATUS_TONE[selected.status] || "forgiven"}>{tournamentStatusLabel(selected.status)}</StatusChip>
        </div>
      ) : (
        <header className="fx-ed-hero">
          <span className="mde-crumb">{formatLabel(selected.format)} · {tournamentStatusLabel(selected.status)}</span>
          <h1>{selected.name}</h1>
          <p className="fx-ed-lede">
            {selected.start_date ? `Desde ${shortDate(selected.start_date)}` : "Sin fecha"}
            {selected.venue ? ` · ${selected.venue}` : ""}
            {hasMatches ? <> · <b className="fx-lede-num">{played}/{matches.length}</b> partidos jugados</> : null}
          </p>
        </header>
      )}
      {error && <p className="fx-alert is-bad" role="alert">{error}</p>}
      {notice && <p className="fx-alert is-good" role="status">{notice}</p>}
      {loading && <p className="fx-hint" role="status">Cargando campeonato…</p>}

      {hasMatches && <ChampionBanner variant={variant} tournament={selected} teams={teams} champion={champion} canManage={canManage} onFinish={finish} />}

      {hasMatches && canManage && selected.status !== "finished" && champion.status === "pending" && (
        <p className="tn-next" data-next-step><b>Próximo paso:</b> {nextStep(selected.format, teams, matches)}</p>
      )}

      {hasMatches && variant === "command" && (
        <Kpis variant="command" items={[
          { label: "Equipos", value: teams.length },
          { label: "Partidos jugados", value: `${played}/${matches.length}`, tone: played === matches.length ? "good" : undefined },
          { label: "Goles", value: goals },
          { label: champion.status === "decided" ? "Campeón" : hasTable ? "Líder" : "Fase", value: champion.status === "decided" ? teams.find((t) => t.id === champion.teamId)?.name : leader?.played ? leader.name : "—", tone: "good" },
        ]} />
      )}

      {!hasTeams && !loading && (canManage
        ? <TeamSetup tournament={selected} teamCount={teamCount} profiles={profiles} ratingMap={ratingMap} onSave={saveTeamsAndCalendar} />
        : <Empty>El organizador todavía está armando los equipos.</Empty>)}

      {hasTeams && !hasMatches && !loading && (
        <Section title="Equipos listos" icon={Shield}
          aside={canManage ? <button className="md-btn md-btn-accent" type="button" onClick={() => generateCalendar().catch(() => {})}><CalendarDays size={15} aria-hidden="true" /> Generar calendario</button> : null}>
          <TeamsGrid variant={variant} teams={teams} teamMembers={teamMembers} profiles={profiles} ratingMap={ratingMap} canManage={false} />
        </Section>
      )}

      {hasMatches && (
        <>
          <nav className="pl-tabs fx-tabs tn-tabs" aria-label="Secciones del campeonato">
            {tabs.map(([id, label, Icon]) => (
              <button key={id} type="button" className={tab === id ? "is-on" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>
          {tab === "fixtures" && <FixturesView variant={variant} tournament={selected} matches={matches} teams={teams} canManage={canManage} onSaveResult={saveResult} />}
          {tab === "standings" && <Section title="Tabla de posiciones" icon={ListOrdered}><StandingsTable variant={variant} tournament={selected} teams={teams} matches={matches} /></Section>}
          {tab === "bracket" && <Section title="Eliminatorias" icon={GitBranch}><Bracket variant={variant} tournament={selected} matches={matches} teams={teams} /></Section>}
          {tab === "teams" && <Section title="Equipos" icon={Shield}><TeamsGrid variant={variant} teams={teams} teamMembers={teamMembers} profiles={profiles} ratingMap={ratingMap} canManage={canManage && selected.status !== "finished"} onAddMember={addMember} onRemoveMember={removeMember} /></Section>}
          {tab === "share" && <Section title="Compartir" icon={Share2}><SharePanel tournament={selected} teams={teams} matches={matches} champion={champion} /></Section>}
        </>
      )}

      {canManage && !loading && (
        <div className="tn-danger">
          {!confirmDelete ? (
            <button className="md-linkbtn tn-delete" type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={14} aria-hidden="true" /> Eliminar campeonato</button>
          ) : (
            <p role="alert" className="tn-delete-confirm">
              ¿Eliminar «{selected.name}» con sus equipos, partidos y tabla? No se puede deshacer.
              <button className="md-btn md-btn-ghost fx-btn-sm" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button className="md-btn fx-btn-sm tn-delete-yes" type="button" onClick={removeTournament}><Check size={14} aria-hidden="true" /> Sí, eliminar</button>
            </p>
          )}
        </div>
      )}
    </>,
    "tournament",
  );
}
