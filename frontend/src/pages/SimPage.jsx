import { useMemo, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import PlayerBadge from "../components/PlayerBadge.jsx";
import { generateBalancedTeams } from "../teamGeneration.js";
import { distributeTeamsWithAI } from "../groq.js";
import { displayName } from "../utils.js";

export default function SimPage({ profiles, ratingMap, isAdmin, isSuperAdmin, skills }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");

  const activePlayers = useMemo(
    () =>
      profiles
        .filter((p) => p.membership_is_active)
        .map((p) => {
          const r = ratingMap.get(p.id) || {};
          return {
            ...p,
            rating: r.rating || 2,
            attack_rating: r.attack_rating || r.rating || 2,
            defense_rating: r.defense_rating || r.rating || 2,
            midfield_rating: r.midfield_rating || r.rating || 2,
            goalkeeper_rating: r.goalkeeper_rating || r.rating || 2,
          };
        }),
    [profiles, ratingMap],
  );

  function toggle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  }

  function selectAll() {
    setSelectedIds(new Set(activePlayers.map((p) => p.id)));
    setResult(null);
  }

  function deselectAll() {
    setSelectedIds(new Set());
    setResult(null);
  }

  function simulate() {
    setError("");
    const selected = activePlayers.filter((p) => selectedIds.has(p.id));
    if (selected.length < 10) {
      setError("Se necesitan al menos 10 jugadores seleccionados.");
      setResult(null);
      return;
    }
    try {
      const generated = generateBalancedTeams(selected);
      setResult(generated);
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  }

  async function simulateWithAI() {
    setError("");
    setAiLoading(true);
    try {
      const selected = activePlayers.filter((p) => selectedIds.has(p.id));
      if (selected.length < 10) {
        setError("Se necesitan al menos 10 jugadores seleccionados.");
        setAiLoading(false);
        return;
      }
      const selectedSkills = (skills || []).filter((s) => selectedIds.has(s.player_id));
      const teamCount = Math.ceil(selected.length / 5);
      const aiTeams = await distributeTeamsWithAI({
        players: selected,
        skills: selectedSkills,
        instructions: aiInstructions,
        teamCount,
      });
      const playerMap = new Map(selected.map((p) => [p.id, p]));
      const teams = aiTeams.map((t, i) => {
        const teamPlayers = (t.playerIds || []).map((id) => playerMap.get(id)).filter(Boolean);
        if (teamPlayers.length === 0) return null;
        return {
          name: t.name || `Equipo ${String.fromCharCode(65 + i)}`,
          team_order: i + 1,
          target_size: teamPlayers.length,
          players: teamPlayers,
          total_rating: teamPlayers.reduce((s, p) => s + (p.rating || 2), 0),
          goalkeeper_count: teamPlayers.filter((p) => p.preferred_position === "Goalkeeper").length,
        };
      }).filter(Boolean);
      if (teams.length === 0 || teams.every((t) => t.players.length === 0)) {
        setError("La IA no pudo asignar jugadores. Intentá de nuevo o usá el algoritmo normal.");
        setAiLoading(false);
        return;
      }
      setResult({ team_count: teams.length, confirmed_player_count: selected.length, teams });
    } catch (err) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="empty-state compact">
            Solo el Super Admin puede generar simulaciones.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Simulación</p>
            <h2>Seleccionar jugadores</h2>
            <small>Elegí los jugadores para simular un partido.</small>
          </div>
          <div className="button-row">
            <span className="count-pill">
              {selectedIds.size}/{activePlayers.length}
            </span>
            <button className="secondary-button" type="button" onClick={selectAll}>
              Todos
            </button>
            <button className="secondary-button" type="button" onClick={deselectAll}>
              Ninguno
            </button>
            <button type="button" onClick={simulate} disabled={selectedIds.size < 10}>
              Simular
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={simulateWithAI}
              disabled={selectedIds.size < 10 || aiLoading}
            >
              {aiLoading ? "🤖..." : "🤖 IA"}
            </button>
          </div>
        </div>
        {error && <p className="form-message">{error}</p>}
        <input
          type="text"
          placeholder="Instrucciones para la IA (opcional): Juan con Pedro, Luis portero..."
          value={aiInstructions}
          onChange={(e) => setAiInstructions(e.target.value)}
          className="ai-instructions-input"
        />
        {activePlayers.length < 10 ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Se necesitan al menos 10 jugadores activos para generar equipos.
          </p>
        ) : (
          <div className="player-list sim-player-list">
            {activePlayers.map((player) => (
              <label
                className={`player-row sim-player-row ${selectedIds.has(player.id) ? "is-selected" : ""}`}
                key={player.id}
              >
                <div className="sim-player-info">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(player.id)}
                    onChange={() => toggle(player.id)}
                  />
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
        )}
      </section>

      {result && (
        <section className="panel">
          <div className="section-heading">
            <h2>Resultado</h2>
            <span className="count-pill">
              {result.team_count} equipos · {result.confirmed_player_count} jugadores · diferencial: {result.fairness_score}
            </span>
          </div>
          <div className="team-grid">
            {result.teams.map((team) => (
              <article className="team-card" key={team.name}>
                <div className="team-header">
                  <strong>{team.name}</strong>
                  <span>{team.total_rating} estrellas</span>
                </div>
                <small>{team.goalkeeper_count} portero(s)</small>
                <ul>
                  {team.players.map((player) => (
                    <li key={player.id}>
                      <span className="team-member">
                        <Avatar profile={player} size="sm" />
                        {displayName(player)}
                        <PlayerBadge rating={ratingMap.get(player.id)} />
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
