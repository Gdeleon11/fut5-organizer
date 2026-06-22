import { useEffect, useMemo, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import PlayerBadge from "../components/PlayerBadge.jsx";
import { api } from "../api.js";
import { generateFixtures, updateStandings } from "../tournamentEngine.js";
import { displayName, formatMatchDate } from "../utils.js";

const FORMATS = [
  { id: "cuadrangular", label: "Cuadrangular", desc: "4 equipos, todos contra todos + final" },
  { id: "league", label: "Liga", desc: "Todos contra todos, campeón por puntos" },
  { id: "league_playoffs", label: "Liga + Playoffs", desc: "Liga regular + semifinales y final" },
  { id: "playoffs_only", label: "Solo Playoffs", desc: "Eliminación directa (2, 4 u 8 equipos)" },
];

const DAYS = [
  { id: "monday", label: "Lunes" },
  { id: "tuesday", label: "Martes" },
  { id: "wednesday", label: "Miércoles" },
  { id: "thursday", label: "Jueves" },
  { id: "friday", label: "Viernes" },
  { id: "saturday", label: "Sábado" },
  { id: "sunday", label: "Domingo" },
];

const TEAM_COLORS = ["#22c55e", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function TournamentForm({ onSave, onCancel, profiles }) {
  const [form, setForm] = useState({
    name: "",
    format: "cuadrangular",
    start_date: "",
    match_time: "19:00",
    match_day: "monday",
    venue: "",
  });
  const [error, setError] = useState("");

  function update(patch) { setForm((f) => ({ ...f, ...patch })); }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Poné el nombre del torneo."); return; }
    if (!form.start_date) { setError("Elegí una fecha de inicio."); return; }
    await onSave(form);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {error && <p className="form-message">{error}</p>}
      <label>
        Nombre del torneo
        <input placeholder="Ej. Liga Apertura 2026" value={form.name} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <label>
        Formato
        <select value={form.format} onChange={(e) => update({ format: e.target.value })}>
          {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} — {f.desc}</option>)}
        </select>
      </label>
      <label>
        Fecha de inicio
        <input type="date" value={form.start_date} onChange={(e) => update({ start_date: e.target.value })} />
      </label>
      <label>
        Día de juego
        <select value={form.match_day} onChange={(e) => update({ match_day: e.target.value })}>
          {DAYS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>
      <label>
        Hora
        <input type="time" value={form.match_time} onChange={(e) => update({ match_time: e.target.value })} />
      </label>
      <label>
        Cancha
        <input placeholder="Opcional" value={form.venue} onChange={(e) => update({ venue: e.target.value })} />
      </label>
      <button type="submit">Crear torneo</button>
      <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
    </form>
  );
}

function TeamAssignment({ tournament, profiles, ratingMap, teams, onGenerate }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [teamCount, setTeamCount] = useState(4);
  const [error, setError] = useState("");

  const activePlayers = profiles.filter((p) => p.membership_is_active);

  function toggle(id) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function selectAll() { setSelectedIds(new Set(activePlayers.map((p) => p.id))); }

  const minTeams = tournament.format === "cuadrangular" ? 4 :
    tournament.format === "playoffs_only" ? 2 : 2;
  const maxTeams = tournament.format === "cuadrangular" ? 4 :
    tournament.format === "playoffs_only" ? 8 : Math.min(activePlayers.length, 12);
  const teamRange = Array.from({ length: maxTeams - minTeams + 1 }, (_, i) => minTeams + i);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Seleccionar jugadores</h2>
          <small>Elegí los participantes y la cantidad de equipos ({teamCount} equipos, {selectedIds.size} jugadores seleccionados).</small>
        </div>
        <div className="button-row">
          <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>
            {teamRange.map((n) => <option key={n} value={n}>{n} equipos</option>)}
          </select>
          <button className="secondary-button" type="button" onClick={selectAll}>Todos</button>
          <button
            type="button"
            disabled={selectedIds.size < teamCount * 2}
            onClick={() => { setError(""); onGenerate([...selectedIds], teamCount); }}
          >
            Generar equipos
          </button>
        </div>
      </div>
      {error && <p className="form-message">{error}</p>}
      {selectedIds.size < teamCount * 2 && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Necesitás al menos {teamCount * 2} jugadores ({selectedIds.size} seleccionados).
        </p>
      )}
      <div className="player-list sim-player-list">
        {activePlayers.map((player) => (
          <label
            className={`player-row sim-player-row ${selectedIds.has(player.id) ? "is-selected" : ""}`}
            key={player.id}
          >
            <div className="sim-player-info">
              <input type="checkbox" checked={selectedIds.has(player.id)} onChange={() => toggle(player.id)} />
              <Avatar profile={player} size="sm" />
              <div>
                <strong>{displayName(player)}</strong>
                <small>{player.preferred_position || "Flexible"}</small>
              </div>
            </div>
            <PlayerBadge rating={ratingMap.get(player.id)} />
          </label>
        ))}
      </div>
    </section>
  );
}

function TeamEditor({ teams, onRemove, onAdd }) {
  const [newName, setNewName] = useState("");
  return (
    <div>
      {teams.map((team, i) => (
        <div className="panel" key={i} style={{ borderLeft: `4px solid ${TEAM_COLORS[i % TEAM_COLORS.length]}` }}>
          <div className="section-heading">
            <strong>{team.name}</strong>
            <span className="count-pill">{team.members.length} jugadores</span>
          </div>
          <div className="player-list">
            {team.members.length === 0 && <div className="empty-state compact">Sin jugadores</div>}
            {team.members.map((pid) => {
              return <div className="player-row" key={pid}><small>{pid}</small></div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FixturesView({ matches, teams, onRecordResult }) {
  const [editingId, setEditingId] = useState(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const rounds = useMemo(() => {
    const map = new Map();
    matches.forEach((m) => {
      if (!map.has(m.round)) map.set(m.round, []);
      map.get(m.round).push(m);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  function saveResult(match) {
    onRecordResult(match.id, Number(homeScore), Number(awayScore));
    setEditingId(null);
    setHomeScore("");
    setAwayScore("");
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Calendario</h2>
        <span className="count-pill">{matches.length} partidos</span>
      </div>
      {rounds.map(([round, roundMatches]) => (
        <div key={round} className="detail-section">
          <div className="section-heading">
            <h2>Jornada {round}</h2>
          </div>
          <div className="ledger-list">
            {roundMatches.map((m) => {
              const home = teamMap.get(m.home_team_id);
              const away = teamMap.get(m.away_team_id);
              const isEditing = editingId === m.id;
              return (
                <article className="ledger-row" key={m.id}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong>{home?.name || " TBD "}</strong>
                      <span style={{ color: "var(--text-muted)" }}>vs</span>
                      <strong>{away?.name || " TBD "}</strong>
                    </div>
                    <small>
                      {m.match_date ? new Date(m.match_date + "T12:00:00").toLocaleDateString("es-GT") : "Fecha pendiente"}
                      {m.match_time ? ` · ${m.match_time}` : ""}
                    </small>
                    {m.is_final && <span className="status-pill" style={{ marginLeft: "0.5rem" }}>Final</span>}
                    {m.is_playoff && m.playoff_label && <span className="status-pill" style={{ marginLeft: "0.5rem" }}>{m.playoff_label}</span>}
                  </div>
                  <div className="ledger-meta">
                    {m.status === "played" ? (
                      <strong className="fine-amount">{m.home_score} - {m.away_score}</strong>
                    ) : isEditing ? (
                      <div className="button-row">
                        <input type="number" min="0" style={{ width: "50px" }} value={homeScore} onChange={(e) => setHomeScore(e.target.value)} placeholder="0" />
                        <span>-</span>
                        <input type="number" min="0" style={{ width: "50px" }} value={awayScore} onChange={(e) => setAwayScore(e.target.value)} placeholder="0" />
                        <button type="button" onClick={() => saveResult(m)}>Guardar</button>
                        <button className="secondary-button" type="button" onClick={() => setEditingId(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="secondary-button" type="button" onClick={() => { setEditingId(m.id); setHomeScore(""); setAwayScore(""); }}>
                        Ingresar resultado
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function StandingsTable({ standings }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Tabla de posiciones</h2>
      </div>
      <div className="standings-table">
        <div className="standings-header">
          <span className="col-pos">#</span>
          <span className="col-team">Equipo</span>
          <span className="col-stat">PJ</span>
          <span className="col-stat">G</span>
          <span className="col-stat">E</span>
          <span className="col-stat">P</span>
          <span className="col-stat">GF</span>
          <span className="col-stat">GC</span>
          <span className="col-stat">Pts</span>
        </div>
        {standings.map((s, i) => (
          <div className="standings-row" key={s.id}>
            <span className="col-pos">{i + 1}</span>
            <span className="col-team">
              <span className="team-dot" style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] }} />
              {s.tournament_team?.name}
            </span>
            <span className="col-stat">{s.played}</span>
            <span className="col-stat">{s.won}</span>
            <span className="col-stat">{s.drawn}</span>
            <span className="col-stat">{s.lost}</span>
            <span className="col-stat">{s.goals_for}</span>
            <span className="col-stat">{s.goals_against}</span>
            <span className="col-stat col-pts">{s.points}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TournamentPage({ activeGroupId, profiles, ratingMap, isAdmin, isSuperAdmin }) {
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

  const selected = tournaments.find((t) => t.id === selectedId);

  useEffect(() => {
    if (!activeGroupId) return;
    api.listTournaments(activeGroupId).then(setTournaments);
  }, [activeGroupId]);

  useEffect(() => {
    if (!selectedId) { setTeams([]); setMatches([]); setStandings([]); setTeamMembers([]); return; }
    setLoading(true);
    Promise.all([
      api.listTournamentTeams(selectedId),
      api.listTournamentMatches(selectedId),
      api.listStandings(selectedId),
      api.listAllTournamentTeamMembers(selectedId),
    ]).then(([t, m, s, tm]) => { setTeams(t); setMatches(m); setStandings(s); setTeamMembers(tm); })
      .finally(() => setLoading(false));
  }, [selectedId]);

  async function createTournament(form) {
    const col = await api.createTournament({ ...form, group_id: activeGroupId, status: "draft" });
    setTournaments((c) => [col, ...c]);
    setSelectedId(col.id);
    setShowForm(false);
  }

  async function generateTeams(playerIds, teamCount) {
    setError("");
    const playerProfiles = profiles.filter((p) => playerIds.includes(p.id));
    const teamNames = ["Equipo A", "Equipo B", "Equipo C", "Equipo D", "Equipo E", "Equipo F", "Equipo G", "Equipo H"];
    const teamPayloads = Array.from({ length: teamCount }, (_, i) => ({
      tournament_id: selectedId,
      name: teamNames[i] || `Equipo ${i + 1}`,
      team_order: i + 1,
    }));
    const createdTeams = await api.createTournamentTeams(selectedId, teamPayloads);
    for (let i = 0; i < createdTeams.length; i++) {
      const membersPerTeam = Math.ceil(playerIds.length / teamCount);
      const start = i * membersPerTeam;
      const members = playerIds.slice(start, start + membersPerTeam);
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

  if (!isSuperAdmin) {
    return (
      <div className="page-grid">
        <section className="panel"><div className="empty-state compact">Solo el Super Admin puede gestionar torneos.</div></section>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Torneos</p>
              <h2>Mis torneos</h2>
            </div>
            <button className="secondary-button" type="button" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancelar" : "+ Nuevo"}
            </button>
          </div>
          {showForm && <TournamentForm onSave={createTournament} onCancel={() => setShowForm(false)} profiles={profiles} />}
          {tournaments.length === 0 && !showForm && <div className="empty-state compact">No hay torneos creados.</div>}
          {tournaments.map((t) => (
            <article className="ledger-row" key={t.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(t.id)}>
              <div>
                <strong>{t.name}</strong>
                <small>{FORMATS.find((f) => f.id === t.format)?.label} · {t.start_date || "Sin fecha"}</small>
              </div>
              <span className={`status-pill ${t.status === "active" ? "is-paid" : ""}`}>
                {t.status === "draft" ? "Borrador" : t.status === "active" ? "Activo" : "Finalizado"}
              </span>
            </article>
          ))}
        </section>
      </div>
    );
  }

  const hasTeams = teams.length > 0;
  const hasMatches = matches.length > 0;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{FORMATS.find((f) => f.id === selected.format)?.label}</p>
            <h2>{selected.name}</h2>
          </div>
          <button className="secondary-button" type="button" onClick={() => setSelectedId(null)}>
            ← Volver
          </button>
        </div>
        {error && <p className="form-message">{error}</p>}
      </section>

      {!hasTeams && <TeamAssignment tournament={selected} profiles={profiles} ratingMap={ratingMap} teams={teams} onGenerate={generateTeams} />}

      {hasTeams && !hasMatches && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Equipos generados</h2>
              <small>{teams.length} equipos · {teamMembers.length} jugadores</small>
            </div>
            <button type="button" onClick={generateCalendar}>Generar calendario</button>
          </div>
          <div className="team-grid">
            {teams.map((team, i) => (
              <article className="team-card" key={team.id} style={{ borderTop: `3px solid ${TEAM_COLORS[i % TEAM_COLORS.length]}` }}>
                <div className="team-header"><strong>{team.name}</strong></div>
                <ul>
                  {teamMembers.filter((m) => m.tournament_team_id === team.id).map((m) => (
                    <li key={m.id}>
                      <span className="team-member">
                        <Avatar profile={m.profiles} size="sm" />
                        {displayName(m.profiles)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {hasMatches && (
        <div className="tab-bar">
          {["fixtures", "standings"].map((t) => (
            <button key={t} className={tab === t ? "" : "secondary-button"} type="button" onClick={() => setTab(t)}>
              {t === "fixtures" ? "Calendario" : "Tabla"}
            </button>
          ))}
        </div>
      )}

      {hasMatches && tab === "fixtures" && <FixturesView matches={matches} teams={teams} onRecordResult={recordResult} />}
      {hasMatches && tab === "standings" && <StandingsTable standings={standings} />}
    </div>
  );
}
