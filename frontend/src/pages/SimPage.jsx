import { useEffect, useMemo, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import PlayerBadge from "../components/PlayerBadge.jsx";
import TeamColorPicker from "../components/TeamColorPicker.jsx";
import { generateBalancedTeams, playerEffectiveRating, fairnessScore } from "../teamGeneration.js";
import { distributeTeamsWithAI } from "../groq.js";
import { displayName, positionLabel } from "../utils.js";
import { ArrowLeft, Check, Sparkles, Users, Zap } from "lucide-react";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { positionShort } from "../matchday/matchDetailModel.js";
import { FifaModal, TeamsPitch, useFifaModal } from "../components/matchdetail/DetailBlocks.jsx";

const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#f97316", "#a855f7", "#1f2937", "#ffffff"];

export default function SimPage({ activeGroupId, profiles, ratingMap, isAdmin, isSuperAdmin, skills, onResultChange, onBack }) {
  const { design } = useAppearance();
  const fifa = useFifaModal();
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
      generated.teams = generated.teams.map((team, i) => ({
        ...team,
        color: TEAM_COLORS[i % TEAM_COLORS.length],
      }));
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
      const aiTeams = await distributeTeamsWithAI({
        players: selected,
        skills: selectedSkills,
        instructions: aiInstructions,
        teamCount: Math.max(2, Math.ceil(selected.length / 5)),
        groupId: activeGroupId,
      });
      const playerMap = new Map(selected.map((p) => [p.id, p]));
      const teamCount = Math.max(2, Math.ceil(selected.length / 5));
      const targetPerTeam = Math.floor(selected.length / teamCount);

      const assignedIds = new Set();
      aiTeams.forEach((t) => (t.playerIds || []).forEach((id) => assignedIds.add(id)));
      const unassignedPlayers = selected.filter((p) => !assignedIds.has(p.id));

      const teams = aiTeams.map((t, i) => {
        let teamPlayers = (t.playerIds || []).map((id) => playerMap.get(id)).filter(Boolean);
        if (i < teamCount && teamPlayers.length < targetPerTeam && unassignedPlayers.length > 0) {
          const needed = targetPerTeam - teamPlayers.length;
          for (let j = 0; j < needed && unassignedPlayers.length > 0; j++) {
            teamPlayers.push(unassignedPlayers.shift());
          }
        }
        if (i < teamCount && teamPlayers.length > targetPerTeam) {
          teamPlayers = teamPlayers.slice(0, targetPerTeam);
          for (let j = teamPlayers.length; j < targetPerTeam && unassignedPlayers.length > 0; j++) {
            teamPlayers.push(unassignedPlayers.shift());
          }
        }
        if (teamPlayers.length === 0) return null;
        return {
          name: t.name || `Equipo ${String.fromCharCode(65 + i)}`,
          team_order: i + 1,
          target_size: teamPlayers.length,
          players: teamPlayers,
          total_rating: teamPlayers.reduce((s, p) => s + playerEffectiveRating(p), 0),
          goalkeeper_count: teamPlayers.filter((p) => (p.skills || []).includes("goalkeeper") || p.preferred_position === "Goalkeeper").length,
          color: TEAM_COLORS[i % TEAM_COLORS.length],
        };
      }).filter(Boolean);

      if (teams.length === 0) {
        setError("La IA no pudo asignar jugadores. Intentá de nuevo o usá el algoritmo normal.");
        setAiLoading(false);
        return;
      }

      const aiFairness = fairnessScore(teams);
      if (aiFairness > 1.5) {
        const fallback = generateBalancedTeams(selected);
        fallback.teams = fallback.teams.map((team, i) => ({
          ...team,
          color: TEAM_COLORS[i % TEAM_COLORS.length],
        }));
        setResult(fallback);
        setError(`La IA generó equipos muy dispares (diferencia de ${aiFairness.toFixed(1)} pts); usé distribución automática.`);
        setAiLoading(false);
        return;
      }

      setResult({ team_count: teams.length, confirmed_player_count: selected.length, teams });
    } catch (err) {
      try {
        const selected = activePlayers.filter((p) => selectedIds.has(p.id));
        if (selected.length >= 10) {
          const fallback = generateBalancedTeams(selected);
          fallback.teams = fallback.teams.map((team, i) => ({
            ...team,
            color: TEAM_COLORS[i % TEAM_COLORS.length],
          }));
          setResult(fallback);
          setError(`IA no disponible (${err.message}). Se usó el balanceador automático.`);
          return;
        }
      } catch {
        // fallback failed too; surface original error
      }
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  function handleColorChange(teamIndex, color) {
    setResult((prev) => {
      if (!prev) return prev;
      const teams = [...prev.teams];
      teams[teamIndex] = { ...teams[teamIndex], color };
      return { ...prev, teams };
    });
  }

  useEffect(() => {
    onResultChange?.(Boolean(result?.teams?.length));
  }, [onResultChange, result]);

  if (!isSuperAdmin) {
    return (
      <div className="mdd mdd-editorial">
        <p className="mdd-empty">Solo el Super Admin puede generar simulaciones.</p>
        <button type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Volver a Partidos
        </button>
      </div>
    );
  }

  const isCommand = design === "command";
  const count = selectedIds.size;
  const ready = count >= 10;
  const pitchTeams = (result?.teams || []).map((team, i) => ({
    key: team.name || `t${i}`,
    name: team.name,
    color: team.color || "#22c55e",
    members: (team.players || []).map((p) => ({
      key: p.id,
      id: p.id,
      name: displayName(p),
      initial: (displayName(p)[0] || "?").toUpperCase(),
      position: p.preferred_position || "Flexible",
      positionLabel: positionLabel(p.preferred_position || "Flexible"),
      positionShort: positionShort(p.preferred_position),
      isGuest: false,
      isMe: false,
      profile: p,
    })),
  }));

  const controls = (
    <div className="msim-controls">
      <div className="msim-count" aria-live="polite">
        <b>{count}</b>
        <span>
          de {activePlayers.length} seleccionados
          <small>{ready ? "Listo para simular" : `Faltan ${10 - count} para simular (mínimo 10)`}</small>
        </span>
      </div>
      <div className="msim-buttons">
        <button type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={selectAll}>Todos</button>
        <button type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={deselectAll}>Ninguno</button>
      </div>
      <label className="mdd-field">
        <span>Instrucciones para la IA (opcional)</span>
        <input type="text" placeholder="Juan con Pedro, Luis portero…" value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} />
      </label>
      <div className="msim-buttons">
        <button type="button" className="md-btn md-btn-accent" onClick={simulate} disabled={!ready}>
          <Zap size={16} aria-hidden="true" /> Simular
        </button>
        <button type="button" className="md-btn md-btn-ghost" onClick={simulateWithAI} disabled={!ready || aiLoading}>
          <Sparkles size={16} aria-hidden="true" /> {aiLoading ? "Generando…" : "Simular con IA"}
        </button>
      </div>
      {error && <p className="mdd-alert tone-warn" role="alert">{error}</p>}
    </div>
  );

  const roster = activePlayers.length === 0 ? (
    <p className="mdd-empty">No hay jugadores activos en el grupo.</p>
  ) : (
    <ul className={isCommand ? "msim-bench" : "msim-list"}>
      {activePlayers.map((player) => {
        const on = selectedIds.has(player.id);
        return (
          <li key={player.id}>
            <label className={`msim-player${on ? " is-on" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(player.id)} />
              <span className="msim-check" aria-hidden="true">{on && <Check size={14} />}</span>
              {isCommand ? (
                <span className="mdd-cc-tok" aria-hidden="true">{(displayName(player)[0] || "?").toUpperCase()}</span>
              ) : (
                <Avatar profile={player} size="sm" />
              )}
              <span className="msim-name">
                {displayName(player)}
                <small>{positionLabel(player.preferred_position || "Flexible")}</small>
              </span>
              <PlayerBadge rating={ratingMap.get(player.id)} />
            </label>
          </li>
        );
      })}
    </ul>
  );

  const results = result && (
    <section className="mdd-section msim-result" aria-labelledby="msim-result-title">
      <div className="mdd-head">
        <h2 id="msim-result-title">{isCommand && <Users size={18} aria-hidden="true" />}Resultado</h2>
        <small>
          {result.team_count} equipos · {result.confirmed_player_count} jugadores
          {result.fairness_score != null ? ` · diferencial ${result.fairness_score}` : ""}
        </small>
      </div>
      {isCommand && pitchTeams.length >= 2 && <TeamsPitch teams={pitchTeams} onOpenPlayer={(p) => p && fifa.open(p)} />}
      <div className={`mdd-team-grid cols-${Math.min(pitchTeams.length, 3)}`}>
        {result.teams.map((team, i) => (
          <article key={team.name} className="mdd-team" style={{ "--team": team.color || "#22c55e" }}>
            <header>
              <span className="mdd-team-dot" aria-hidden="true" />
              <h3>{team.name}</h3>
              <small>
                {team.players.length} jugadores · {team.total_rating} ★ · {team.goalkeeper_count} portero(s)
              </small>
            </header>
            <div className="msim-color">
              <TeamColorPicker currentColor={team.color} onColorChange={(color) => handleColorChange(i, color)} compact />
            </div>
            <ul>
              {pitchTeams[i].members.map((m) => (
                <li key={m.key}>
                  <button type="button" onClick={() => fifa.open(m.profile)}>
                    <span className="mdd-team-pos">{m.positionShort}</span>
                    <span className="mdd-team-name">{m.name}</span>
                    <PlayerBadge rating={ratingMap.get(m.id)} />
                  </button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );

  return (
    <div className={`md-matches md-design-${design}`} data-design={design} data-view="pizarra">
      {isCommand ? (
        <div className="mdd mdd-command mdc msim msim-command">
          <div className="mdc-bar">
            <button type="button" className="md-btn md-btn-ghost md-btn-sm mdd-back" onClick={onBack}>
              <ArrowLeft size={16} aria-hidden="true" /> Partidos
            </button>
            <h1>Pizarra táctica</h1>
            <span className="mdc-pill">Solo administradores</span>
          </div>
          <div className="mdd-cc-grid">
            <section className="mdd-section" aria-labelledby="msim-bench-title">
              <div className="mdd-head">
                <h2 id="msim-bench-title"><Users size={18} aria-hidden="true" />Banca</h2>
                <small>Toca para convocar a la simulación</small>
              </div>
              {roster}
            </section>
            <aside className="mdd-section msim-panel">
              <div className="mdd-head"><h2><Zap size={18} aria-hidden="true" />Simulación</h2></div>
              {controls}
            </aside>
          </div>
          {results}
        </div>
      ) : (
        <div className="mdd mdd-editorial mde msim msim-editorial">
          <div className="mdd-topline">
            <button type="button" className="md-linkbtn mdd-back" onClick={onBack}>
              <ArrowLeft size={16} aria-hidden="true" /> Partidos
            </button>
            <span className="mde-crumb">Exclusivo para administradores</span>
          </div>
          <header className="msim-hero">
            <h1>Pizarra táctica</h1>
            <p>Elige jugadores del grupo y prueba combinaciones de equipos antes del partido. No modifica ningún partido real.</p>
          </header>
          <div className="mdd-ed-cols">
            <section className="mdd-section" aria-labelledby="msim-sel-title">
              <div className="mdd-head"><h2 id="msim-sel-title">Jugadores</h2><small>{count} seleccionados</small></div>
              {roster}
            </section>
            <aside className="mdd-section msim-panel">
              <div className="mdd-head"><h2>Simulación</h2></div>
              {controls}
            </aside>
          </div>
          {results}
        </div>
      )}
      <FifaModal player={fifa.player} onClose={fifa.close} ratingMap={ratingMap} skills={skills} matchStats={[]} />
    </div>
  );
}
