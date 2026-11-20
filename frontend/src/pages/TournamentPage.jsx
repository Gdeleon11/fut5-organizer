import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronRight, GitBranch, ListOrdered, PlusCircle, Shield, Trophy, Users, Wand2, X } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import { api } from "../api.js";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { generateFixtures, updateStandings } from "../tournamentEngine.js";
import { Empty, Kpis, Section, StatusChip } from "../components/finance/FinanceBlocks.jsx";
import {
  DAYS, FORMATS, bracketColumns, formGuide, formatLabel, groupRounds, isPlayoffMatch, matchWinner,
  teamColor, teamRating, tournamentProgress, tournamentStatusLabel,
} from "../tournament/tournamentModel.js";
import { displayName } from "../utils.js";

const STATUS_TONE = { draft: "forgiven", active: "paid", finished: "review" };
const shortDate = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" }) : "Fecha pendiente");

function TournamentForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "", format: "league", start_date: "", match_time: "19:00",
    match_day: "monday", venue: "", team_count: 4,
  });
  const [error, setError] = useState("");
  const update = (p) => setForm((f) => ({ ...f, ...p }));

  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.name.trim()) { setError("Poné el nombre del torneo."); return; }
    if (!form.start_date) { setError("Elegí una fecha de inicio."); return; }
    if (form.team_count < 2) { setError("Mínimo 2 equipos."); return; }
    await onSave(form);
  }

  return (
    <form className="form-grid md-form fx-form fx-create" onSubmit={submit} aria-label="Nuevo torneo">
      {error && <p className="form-message" role="alert">{error}</p>}
      <label className="md-form-wide">Nombre del torneo
        <input placeholder="Ej. Liga Apertura 2026" value={form.name} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <fieldset className="md-form-group tn-formats">
        <legend>Formato</legend>
        {FORMATS.map((f) => (
          <label key={f.id} className={`tn-format ${form.format === f.id ? "is-on" : ""}`}>
            <input type="radio" name="tn-format" value={f.id} checked={form.format === f.id} onChange={() => update({ format: f.id })} />
            <b>{f.label}</b><small>{f.desc}</small>
          </label>
        ))}
      </fieldset>
      <label>Cantidad de equipos
        <input type="number" min="2" max="8" inputMode="numeric" value={form.team_count} onChange={(e) => update({ team_count: Number(e.target.value) })} />
      </label>
      <label>Fecha de inicio
        <input type="date" value={form.start_date} onChange={(e) => update({ start_date: e.target.value })} />
      </label>
      <label>Día de juego
        <select value={form.match_day} onChange={(e) => update({ match_day: e.target.value })}>
          {DAYS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>
      <label>Hora
        <input type="time" value={form.match_time} onChange={(e) => update({ match_time: e.target.value })} />
      </label>
      <label className="md-form-wide">Cancha
        <input placeholder="Opcional" value={form.venue} onChange={(e) => update({ venue: e.target.value })} />
      </label>
      <div className="md-form-actions">
        <button className="md-btn md-btn-ghost" type="button" onClick={onCancel}>Cancelar</button>
        <button className="md-btn md-btn-accent" type="submit">Crear torneo</button>
      </div>
    </form>
  );
}

function TeamSetup({ tournament, profiles, ratingMap, onSave }) {
  const [teamNames, setTeamNames] = useState(
    Array.from({ length: tournament.team_count || 4 }, (_, i) => `Equipo ${String.fromCharCode(65 + i)}`)
  );
  const [step, setStep] = useState("names"); // "names" | "assign"
  const [assignments, setAssignments] = useState({}); // { teamIndex: [profileId, ...] }
  const [error, setError] = useState("");

  const activePlayers = profiles.filter((p) => p.membership_is_active);
  const assignedIds = new Set(Object.values(assignments).flat());
  const unassigned = activePlayers.filter((p) => !assignedIds.has(p.id));

  function updateTeamName(idx, name) {
    setTeamNames((prev) => { const n = [...prev]; n[idx] = name; return n; });
  }
  function addTeam() {
    setTeamNames((prev) => [...prev, `Equipo ${String.fromCharCode(65 + prev.length)}`]);
  }
  function removeTeam(idx) {
    if (teamNames.length <= 2) return;
    setTeamNames((prev) => prev.filter((_, i) => i !== idx));
    setAssignments((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
  }
  function assignPlayer(teamIdx, playerId) {
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { next[k] = next[k].filter((id) => id !== playerId); });
      next[teamIdx] = [...(next[teamIdx] || []), playerId];
      return next;
    });
  }
  function unassignPlayer(playerId) {
    setAssignments((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => { next[k] = v.filter((id) => id !== playerId); });
      return next;
    });
  }
  function autoBalance() {
    const sorted = [...activePlayers].sort((a, b) => {
      const ra = ratingMap.get(a.id)?.rating || 2;
      const rb = ratingMap.get(b.id)?.rating || 2;
      return rb - ra;
    });
    const newAssignments = {};
    teamNames.forEach((_, i) => { newAssignments[i] = []; });
    sorted.forEach((p, i) => { newAssignments[i % teamNames.length].push(p.id); });
    setAssignments(newAssignments);
  }
  async function finish() {
    setError("");
    const emptyTeams = teamNames.filter((_, i) => (assignments[i] || []).length < 5);
    if (emptyTeams.length > 0) {
      setError(`Cada equipo necesita al menos 5 jugadores. Faltan: ${emptyTeams.join(", ")}`);
      return;
    }
    await onSave(teamNames, assignments);
  }

  return (
    <Section
      title={step === "names" ? "Paso 1 · Nombrar equipos" : "Paso 2 · Asignar jugadores"}
      icon={Users}
      className="tn-setup"
      aside={step === "names" ? (
        <>
          <button className="md-btn md-btn-ghost" type="button" onClick={addTeam}><PlusCircle size={15} aria-hidden="true" /> Equipo</button>
          <button className="md-btn md-btn-accent" type="button" onClick={() => setStep("assign")}>Siguiente <ChevronRight size={15} aria-hidden="true" /></button>
        </>
      ) : (
        <>
          <button className="md-btn md-btn-ghost" type="button" onClick={() => setStep("names")}><ArrowLeft size={15} aria-hidden="true" /> Nombres</button>
          <button className="md-btn md-btn-ghost" type="button" onClick={autoBalance}><Wand2 size={15} aria-hidden="true" /> Auto-balancear</button>
          <button className="md-btn md-btn-accent" type="button" onClick={finish}>Crear equipos</button>
        </>
      )}
    >
      <ol className="tn-steps" aria-label="Progreso">
        <li className="is-done">Torneo</li><li className={step === "names" ? "is-now" : "is-done"}>Equipos</li><li className={step === "assign" ? "is-now" : ""}>Jugadores</li><li>Calendario</li>
      </ol>
      {error && <p className="fx-alert is-bad" role="alert">{error}</p>}
      {step === "names" ? (
        <ul className="tn-name-list">
          {teamNames.map((name, i) => (
            <li key={i} style={{ "--tn-team": teamColor(i) }}>
              <span className="tn-swatch" aria-hidden="true" />
              <input type="text" aria-label={`Nombre del equipo ${i + 1}`} value={name} onChange={(e) => updateTeamName(i, e.target.value)} />
              {teamNames.length > 2 && (
                <button className="fx-icon is-reject" type="button" aria-label={`Quitar ${name}`} onClick={() => removeTeam(i)}><X size={16} aria-hidden="true" /></button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="fx-hint">Mínimo 5 jugadores por equipo · {unassigned.length} sin asignar.</p>
          <div className="tn-assign-grid">
            {teamNames.map((name, i) => {
              const members = assignments[i] || [];
              return (
                <article key={i} className="tn-assign" style={{ "--tn-team": teamColor(i) }}>
                  <header>
                    <b>{name}</b>
                    <small className={members.length >= 5 ? "is-ok" : ""}>{members.length} jug · {teamRating(members, ratingMap)} ★</small>
                  </header>
                  <ul>
                    {members.map((pid) => {
                      const player = profiles.find((p) => p.id === pid);
                      return (
                        <li key={pid}>
                          <span><Avatar profile={player} size="sm" />{displayName(player)}</span>
                          <button className="md-icon-btn" type="button" aria-label={`Quitar a ${displayName(player)}`} onClick={() => unassignPlayer(pid)}><X size={15} aria-hidden="true" /></button>
                        </li>
                      );
                    })}
                  </ul>
                  <select className="rv-select" value="" aria-label={`Agregar jugador a ${name}`} onChange={(e) => { if (e.target.value) assignPlayer(i, e.target.value); }}>
                    <option value="">+ Agregar jugador</option>
                    {unassigned.map((p) => <option key={p.id} value={p.id}>{displayName(p)} ({ratingMap.get(p.id)?.rating || 2}⭐)</option>)}
                  </select>
                </article>
              );
            })}
          </div>
        </>
      )}
    </Section>
  );
}

function TeamBadge({ team, index, align = "start" }) {
  return (
    <span className={`tn-team is-${align}`} style={{ "--tn-team": teamColor(index) }}>
      <i aria-hidden="true" />{team?.name || "Por definir"}
    </span>
  );
}

function ScoreEditor({ onSave, onCancel }) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  return (
    <span className="tn-score-edit">
      <input type="number" min="0" inputMode="numeric" aria-label="Goles local" value={home} onChange={(e) => setHome(e.target.value)} placeholder="0" />
      <span aria-hidden="true">–</span>
      <input type="number" min="0" inputMode="numeric" aria-label="Goles visitante" value={away} onChange={(e) => setAway(e.target.value)} placeholder="0" />
      <button className="md-btn md-btn-accent fx-btn-sm" type="button" onClick={() => onSave(home, away)}>OK</button>
      <button className="fx-icon is-reject" type="button" aria-label="Cancelar" onClick={onCancel}><X size={15} aria-hidden="true" /></button>
    </span>
  );
}

function FixturesView({ variant, matches, teams, onRecordResult }) {
  const [editingId, setEditingId] = useState(null);
  const teamIndex = useMemo(() => new Map(teams.map((t, i) => [t.id, i])), [teams]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const rounds = useMemo(() => groupRounds(matches), [matches]);
  const playoffRounds = rounds.filter((r) => r.playoff);

  function saveResult(match, homeScore, awayScore) {
    onRecordResult(match.id, Number(homeScore), Number(awayScore));
    setEditingId(null);
  }

  return (
    <div className={`tn-rounds is-${variant}`}>
      {rounds.map((g) => {
        const title = g.playoff ? (bracketColumns(matches).find((c) => c.round === g.round)?.title || `Ronda ${g.round}`) : `Jornada ${g.round}`;
        return (
          <section key={g.round} className="tn-round" aria-label={title}>
            <header className="tn-round-head">
              <h3>{title}</h3>
              <small>{shortDate(g.date)} · {g.played}/{g.matches.length} jugados</small>
              {g.playoff && playoffRounds.length > 0 && <StatusChip tone="review">Playoff</StatusChip>}
            </header>
            <ul className="tn-fixtures">
              {g.matches.map((m) => {
                const home = teamMap.get(m.home_team_id);
                const away = teamMap.get(m.away_team_id);
                const winner = matchWinner(m);
                return (
                  <li key={m.id} className={`tn-fixture ${m.status === "played" ? "is-played" : ""}`}>
                    <span className={`tn-side is-home ${winner && winner === m.home_team_id ? "is-win" : ""}`}><TeamBadge team={home} index={teamIndex.get(m.home_team_id) ?? 0} align="end" /></span>
                    <span className="tn-mid">
                      {m.status === "played" ? (
                        <b className="tn-score" aria-label={`Resultado ${m.home_score} a ${m.away_score}`}>{m.home_score}<i>–</i>{m.away_score}</b>
                      ) : editingId === m.id ? (
                        <ScoreEditor onSave={(h, a) => saveResult(m, h, a)} onCancel={() => setEditingId(null)} />
                      ) : (
                        <button className="md-btn md-btn-ghost fx-btn-sm" type="button" onClick={() => setEditingId(m.id)}>Resultado</button>
                      )}
                      <small>{m.match_time || ""}{m.playoff_label ? ` · ${m.playoff_label}` : ""}</small>
                    </span>
                    <span className={`tn-side is-away ${winner && winner === m.away_team_id ? "is-win" : ""}`}><TeamBadge team={away} index={teamIndex.get(m.away_team_id) ?? 1} /></span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function StandingsTable({ variant, standings, teams, matches }) {
  const teamIndex = new Map(teams.map((t, i) => [t.id, i]));
  const maxPts = Math.max(1, ...standings.map((s) => s.points || 0));
  return (
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
        {standings.map((s, i) => {
          const idx = teamIndex.get(s.tournament_team_id) ?? i;
          const dg = (s.goals_for || 0) - (s.goals_against || 0);
          return (
            <tr key={s.id} className={i === 0 ? "is-leader" : ""}>
              <td className="tn-pos">{i + 1}</td>
              <td><TeamBadge team={s.tournament_team} index={idx} /></td>
              <td className="num">{s.played}</td><td className="num">{s.won}</td>
              <td className="num">{s.drawn}</td><td className="num">{s.lost}</td>
              <td className="num tn-hide-sm">{s.goals_for}</td><td className="num tn-hide-sm">{s.goals_against}</td>
              <td className="num">{dg > 0 ? `+${dg}` : dg}</td>
              <td className="tn-hide-sm"><span className="tn-form" aria-label="Últimos resultados">{formGuide(matches, s.tournament_team_id).map((r, k) => <i key={k} className={`is-${r}`}>{r}</i>)}</span></td>
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
  );
}

function Bracket({ variant, matches, teams }) {
  const cols = bracketColumns(matches);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const teamIndex = new Map(teams.map((t, i) => [t.id, i]));
  if (cols.length === 0) return <Empty>Este formato no tiene llaves eliminatorias.</Empty>;
  return (
    <div className={`tn-bracket is-${variant}`} role="list" aria-label="Llaves eliminatorias">
      {cols.map((c) => (
        <section key={c.round} className="tn-col" role="listitem" aria-label={c.title}>
          <h3>{c.title}</h3>
          <div className="tn-col-matches">
            {c.matches.map((m) => {
              const w = matchWinner(m);
              const row = (id, score) => (
                <div className={`tn-slot ${w && w === id ? "is-win" : ""} ${w && id && w !== id ? "is-out" : ""}`}>
                  <TeamBadge team={teamMap.get(id)} index={teamIndex.get(id) ?? 0} />
                  <b>{m.status === "played" ? score : ""}</b>
                </div>
              );
              return (
                <article key={m.id} className="tn-tie">
                  {m.playoff_label && <small>{m.playoff_label}</small>}
                  {row(m.home_team_id, m.home_score)}
                  {row(m.away_team_id, m.away_score)}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function TeamsGrid({ variant, teams, teamMembers, profiles, ratingMap }) {
  return (
    <div className={`tn-teams is-${variant}`}>
      {teams.map((team, i) => {
        const members = teamMembers.filter((m) => m.tournament_team_id === team.id);
        return (
          <article className="tn-team-card" key={team.id} style={{ "--tn-team": teamColor(i) }}>
            <header>
              <TeamBadge team={team} index={i} />
              <small>{members.length} jug · {teamRating(members.map((m) => m.profile_id || m.profiles?.id), ratingMap)} ★</small>
            </header>
            <ul>
              {members.map((m) => {
                const player = m.profiles || profiles.find((p) => p.id === m.profile_id);
                return <li key={m.id}><Avatar profile={player} size="sm" />{displayName(player)}</li>;
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

export default function TournamentPage({ activeGroupId, profiles, ratingMap, isAdmin, isSuperAdmin, isDemoMode = false }) {
  const [tournaments, setTournaments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("fixtures");
  const [error, setError] = useState("");
  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";

  const selected = tournaments.find((t) => t.id === selectedId);

  useEffect(() => {
    if (import.meta.env.DEV && isDemoMode) {
      // Local demo only (stripped from production builds): read-only sample tournaments.
      import("../dev/tournamentDemo.js").then((d) => setTournaments(d.demoTournaments(profiles)));
      return;
    }
    if (!activeGroupId || isDemoMode) return;
    api.listTournaments(activeGroupId).then(setTournaments).catch(() => setTournaments([]));
  }, [activeGroupId, isDemoMode]);

  useEffect(() => {
    if (import.meta.env.DEV && isDemoMode && selectedId) {
      import("../dev/tournamentDemo.js").then((d) => {
        const t = d.demoTournamentDetail(selectedId, profiles);
        setTeams(t.teams); setMatches(t.matches); setStandings(t.standings); setTeamMembers(t.members);
      });
      return;
    }
    if (!selectedId || isDemoMode) { setTeams([]); setMatches([]); setStandings([]); setTeamMembers([]); return; }
    setLoading(true);
    Promise.all([
      api.listTournamentTeams(selectedId),
      api.listTournamentMatches(selectedId),
      api.listStandings(selectedId),
      api.listAllTournamentTeamMembers(selectedId),
    ]).then(([t, m, s, tm]) => { setTeams(t); setMatches(m); setStandings(s); setTeamMembers(tm); })
      .catch(() => { setTeams([]); setMatches([]); setStandings([]); setTeamMembers([]); })
      .finally(() => setLoading(false));
  }, [selectedId, isDemoMode]);

  async function createTournament(form) {
    const { team_count, ...rest } = form;
    const col = await api.createTournament({ ...rest, group_id: activeGroupId, status: "draft" });
    setTournaments((c) => [col, ...c]);
    setSelectedId(col.id);
    setShowForm(false);
  }

  async function saveTeams(teamNames, assignments) {
    setError("");
    const teamPayloads = teamNames.map((name, i) => ({
      tournament_id: selectedId, name, team_order: i + 1,
    }));
    const createdTeams = await api.createTournamentTeams(selectedId, teamPayloads);
    for (let i = 0; i < createdTeams.length; i++) {
      const members = assignments[i] || [];
      if (members.length > 0) await api.addTournamentTeamMembers(createdTeams[i].id, members);
    }
    const allTeams = await api.listTournamentTeams(selectedId);
    const allMembers = await api.listAllTournamentTeamMembers(selectedId);
    setTeams(allTeams);
    setTeamMembers(allMembers);
    await api.updateTournament(selectedId, { status: "active" });
    setTournaments((c) => c.map((t) => t.id === selectedId ? { ...t, status: "active" } : t));
  }

  async function generateCalendar() {
    if (teams.length < 2) { setError("Necesitás al menos 2 equipos."); return; }
    const fixtures = generateFixtures(
      selected.format, teams, selected.start_date, selected.match_day, selected.match_time, selected.venue,
    );
    await api.createTournamentMatches(fixtures.map((f) => ({ ...f, tournament_id: selectedId })));
    await api.initStandings(selectedId, teams.map((t) => t.id));
    const m = await api.listTournamentMatches(selectedId);
    const s = await api.listStandings(selectedId);
    setMatches(m);
    setStandings(s);
  }

  async function recordResult(matchId, homeScore, awayScore) {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    await api.updateTournamentMatch(matchId, { home_score: homeScore, away_score: awayScore, status: "played" });
    setMatches((c) => c.map((m) => m.id === matchId ? { ...m, home_score: homeScore, away_score: awayScore, status: "played" } : m));
    if (match.home_team_id && match.away_team_id) {
      const newStandings = updateStandings([...standings], match.home_team_id, match.away_team_id, homeScore, awayScore);
      for (const s of newStandings) {
        await api.updateStanding(s.id, {
          played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
          goals_for: s.goals_for, goals_against: s.goals_against, points: s.points,
        });
      }
      const updated = await api.listStandings(selectedId);
      setStandings(updated);
    }
  }

  const shellClass = variant === "command" ? "mdc fx-shell" : "mde fx-shell";
  const wrap = (children, view = "tournaments") => (
    <div className={`md-matches md-design-${variant} fx-page tn-page`} data-design={variant} data-view={view}>
      <div className={shellClass}>{children}</div>
    </div>
  );

  if (!isSuperAdmin) {
    return wrap(<Empty>Solo el Super Admin puede gestionar torneos.</Empty>);
  }

  if (!selected) {
    const active = tournaments.filter((t) => t.status === "active").length;
    return wrap(
      <>
        {variant === "command" ? (
          <div className="mdc-bar">
            <h1>Torneos</h1>
            <span className="mdc-pill"><Trophy size={14} aria-hidden="true" /> <b>{tournaments.length}</b> torneos</span>
            <span className="mdc-pill"><b>{active}</b> activos</span>
          </div>
        ) : (
          <header className="fx-ed-hero">
            <span className="mde-crumb">Competencias del grupo</span>
            <h1>Torneos</h1>
            <p className="fx-ed-lede"><b className="fx-lede-num">{tournaments.length}</b> torneos · <b className="fx-lede-num">{active}</b> activos</p>
          </header>
        )}
        <Section
          title="Mis torneos"
          icon={Trophy}
          aside={<button className={`md-btn ${showForm ? "md-btn-ghost" : "md-btn-accent"}`} type="button" onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : <><PlusCircle size={15} aria-hidden="true" /> Nuevo torneo</>}</button>}
        >
          {showForm && <TournamentForm onSave={createTournament} onCancel={() => setShowForm(false)} />}
          {tournaments.length === 0 && !showForm && <Empty>No hay torneos creados.</Empty>}
          <ul className={`tn-list is-${variant}`}>
            {tournaments.map((t, i) => (
              <li key={t.id}>
                <button type="button" className="tn-list-item" onClick={() => setSelectedId(t.id)}>
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

  const hasTeams = teams.length > 0;
  const hasMatches = matches.length > 0;
  const hasBracket = matches.some(isPlayoffMatch);
  const progress = tournamentProgress(matches);
  const leader = standings[0]?.tournament_team?.name;
  const tabs = [
    ["fixtures", "Calendario", CalendarDays],
    ["standings", "Tabla", ListOrdered],
    ...(hasBracket ? [["bracket", "Llaves", GitBranch]] : []),
    ["teams", "Equipos", Shield],
  ];

  return wrap(
    <>
      <button className="mdd-back md-btn md-btn-ghost tn-back" type="button" onClick={() => { setSelectedId(null); setTab("fixtures"); }}><ArrowLeft size={16} aria-hidden="true" /> Torneos</button>
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
            {hasMatches ? <> · <b className="fx-lede-num">{progress.played}/{progress.total}</b> partidos jugados</> : null}
          </p>
        </header>
      )}
      {error && <p className="fx-alert is-bad" role="alert">{error}</p>}
      {loading && <p className="fx-hint" role="status">Cargando torneo…</p>}

      {hasMatches && variant === "command" && (
        <Kpis variant="command" items={[
          { label: "Equipos", value: teams.length },
          { label: "Partidos jugados", value: `${progress.played}/${progress.total}`, tone: progress.played === progress.total ? "good" : undefined },
          { label: "Goles", value: progress.goals },
          { label: "Líder", value: leader || "—", tone: leader ? "good" : undefined },
        ]} />
      )}

      {!hasTeams && !loading && <TeamSetup tournament={selected} profiles={profiles} ratingMap={ratingMap} onSave={saveTeams} />}

      {hasTeams && !hasMatches && (
        <Section
          title="Equipos listos"
          icon={Shield}
          aside={<>
            <small>{teams.length} equipos · {teamMembers.length} jugadores</small>
            <button className="md-btn md-btn-accent" type="button" onClick={generateCalendar}><CalendarDays size={15} aria-hidden="true" /> Generar calendario</button>
          </>}
        >
          <TeamsGrid variant={variant} teams={teams} teamMembers={teamMembers} profiles={profiles} ratingMap={ratingMap} />
        </Section>
      )}

      {hasMatches && (
        <>
          <nav className="pl-tabs fx-tabs" aria-label="Secciones del torneo">
            {tabs.map(([id, label, Icon]) => (
              <button key={id} type="button" className={tab === id ? "is-on" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>
          {tab === "fixtures" && <FixturesView variant={variant} matches={matches} teams={teams} onRecordResult={recordResult} />}
          {tab === "standings" && <Section title="Tabla de posiciones" icon={ListOrdered}><StandingsTable variant={variant} standings={standings} teams={teams} matches={matches} /></Section>}
          {tab === "bracket" && <Section title="Llaves" icon={GitBranch}><Bracket variant={variant} matches={matches} teams={teams} /></Section>}
          {tab === "teams" && <Section title="Equipos" icon={Shield}><TeamsGrid variant={variant} teams={teams} teamMembers={teamMembers} profiles={profiles} ratingMap={ratingMap} /></Section>}
        </>
      )}
    </>,
    "tournament",
  );
}
