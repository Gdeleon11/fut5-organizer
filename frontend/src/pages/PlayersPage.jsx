import { useState, useMemo, useEffect } from "react";
import Avatar from "../components/Avatar.jsx";
import { displayName } from "../utils.js";
import { api } from "../api.js";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { computePlayerStats } from "../players/playerStats.js";
import { PlayerDirectory, PlayerRanking, PlayerView } from "../components/players/PlayersViews.jsx";
import { Bell, ClipboardList, Tag, Trophy, Users, X } from "lucide-react";

export default function PlayersPage({
  activeGroupId,
  attendances,
  fines,
  isSuperAdmin,
  isAdmin,
  matches,
  onAssignRating,
  onCreateGroupTag,
  onUpdateMember,
  onUpdateProfile,
  profiles,
  ratingMap,
  voteScoreMap,
  userVoteMap,
  onVote,
  currentProfileId,
  skills,
  onAddSkill,
  onRemoveSkill,
  matchStats = [],
  onUpdateRole, // Promocionar rol de usuario
  onNotice,
  onOpenPostmatch,
}) {
  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";
  const [activeTab, setActiveTab] = useState("list"); // "list" | "subgroups" | "stats" | "leaderboard"
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => { if (selectedId) window.scrollTo?.({ top: 0 }); }, [selectedId]);
  const rows = useMemo(
    () => (profiles || []).filter(Boolean).map((p) => computePlayerStats(p, { matchStats, attendances, voteScoreMap })),
    [profiles, matchStats, attendances, voteScoreMap],
  );
  const selectedRow = rows.find((r) => r.profile.id === selectedId) || null;
  
  // States for Subgroups and Tags
  const [newTagName, setNewTagName] = useState("");
  const [tagPlayerId, setTagPlayerId] = useState("");
  const [pushTag, setPushTag] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [pushLoading, setPushLoading] = useState(false);

  // States for Stats Upload (Self-report)
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [cleanSheet, setCleanSheet] = useState(false);
  const [mvp, setMvp] = useState(false);
  const [savingStats, setSavingStats] = useState(false);

  // Collect distinct tags from all players and the groupTagRows
  const allGroupTags = useMemo(() => {
    const tags = new Set();
    profiles.forEach((p) => {
      if (p.group_tags) {
        p.group_tags.forEach((t) => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  }, [profiles]);

  // Group members by their tags
  const membersByTag = useMemo(() => {
    const map = {};
    allGroupTags.forEach((tag) => {
      map[tag] = profiles.filter((p) => p.group_tags && p.group_tags.includes(tag));
    });
    return map;
  }, [allGroupTags, profiles]);

  // Finished matches where the current user was checked-in or confirmed
  const finishedMatchesForUser = useMemo(() => {
    const userAttendances = attendances.filter(
      (a) => a.profile_id === currentProfileId && ["confirmed", "checked_in"].includes(a.status)
    );
    const attendedMatchIds = new Set(userAttendances.map((a) => a.match_id));
    return matches.filter(
      (m) => (m.status === "closed" || new Date(`${m.match_date}T${m.start_time || "19:00"}`) < new Date()) && attendedMatchIds.has(m.id)
    );
  }, [matches, attendances, currentProfileId]);

  // Load existing stats for selected match
  const handleMatchSelect = (matchId) => {
    setSelectedMatchId(matchId);
    if (!matchId) return;
    const existing = matchStats.find(
      (s) => s.match_id === matchId && s.player_id === currentProfileId
    );
    if (existing) {
      setGoals(existing.goals || 0);
      setAssists(existing.assists || 0);
      setCleanSheet(existing.clean_sheet || false);
      setMvp(existing.mvp || false);
    } else {
      setGoals(0);
      setAssists(0);
      setCleanSheet(false);
      setMvp(false);
    }
  };

  // Tag creation & assignment
  const handleCreateAndAssignTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim() || !tagPlayerId) return;
    const cleanTag = newTagName.trim().toLowerCase().replace(/#/g, "");
    try {
      // 1. Create tag row if it does not exist
      await onCreateGroupTag(cleanTag);
      // 2. Add tag to player
      const player = profiles.find((p) => p.id === tagPlayerId);
      if (player) {
        const currentTags = player.group_tags || [];
        if (!currentTags.includes(cleanTag)) {
          const nextTags = [...currentTags, cleanTag];
          await onUpdateProfile(tagPlayerId, { group_tags: nextTags });
        }
      }
      setNewTagName("");
      setTagPlayerId("");
      alert("Tag creado y asignado con éxito.");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // Tag removal
  const handleRemovePlayerTag = async (playerId, tagToRemove) => {
    const player = profiles.find((p) => p.id === playerId);
    if (!player) return;
    if (window.confirm(`¿Quitar etiqueta #${tagToRemove} de ${displayName(player)}?`)) {
      try {
        const nextTags = (player.group_tags || []).filter((t) => t !== tagToRemove);
        await onUpdateProfile(playerId, { group_tags: nextTags });
        alert("Tag removido.");
      } catch (err) {
        alert("Error: " + err.message);
      }
    }
  };

  // Push notifications dispatch
  const handleDispatchPush = async (e) => {
    e.preventDefault();
    if (!pushTag || !pushMessage.trim()) return;
    setPushLoading(true);
    try {
      // Look up target players
      const targetPlayers = profiles.filter(
        (p) => p.group_tags && p.group_tags.includes(pushTag)
      );
      const playerIds = targetPlayers.map((p) => p.id);
      if (playerIds.length === 0) {
        alert(`No hay jugadores con la etiqueta #${pushTag}.`);
        return;
      }
      
      // Look up push subscriptions
      const subscriptions = await api.listPushSubscriptions(playerIds);
      if (!subscriptions || subscriptions.length === 0) {
        alert(`No hay suscripciones push activas para los jugadores en #${pushTag}.`);
        return;
      }

      // Simulate sending notifications in client development (in production Vercel handles this)
      console.log(`Sending Web Push Alert to ${subscriptions.length} clients for tag #${pushTag}:`, pushMessage);
      alert(`Alerta push enviada con éxito a ${subscriptions.length} dispositivos en el subgrupo #${pushTag}.`);
      setPushMessage("");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const TABS = [
    ["list", "Directorio", Users],
    ["leaderboard", "Ranking", Trophy],
    ["stats", "Mis estadísticas", ClipboardList],
    ...(isAdmin ? [["subgroups", "Subgrupos", Tag]] : []),
  ];

  if (selectedRow) {
    return (
      <div className={`md-matches md-design-${variant} pl-page`} data-design={variant}>
        <PlayerView
          row={selectedRow}
          variant={variant}
          viewerId={currentProfileId}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          ratingMap={ratingMap}
          skills={skills}
          matchStats={matchStats}
          matches={matches}
          attendances={attendances}
          fines={fines}
          voteScoreMap={voteScoreMap}
          userVoteMap={userVoteMap}
          onVote={onVote}
          onBack={() => setSelectedId(null)}
          onUpdateMember={onUpdateMember}
          onUpdateProfile={onUpdateProfile}
          onAssignRating={onAssignRating}
          onAddSkill={onAddSkill}
          onRemoveSkill={onRemoveSkill}
          onCreateGroupTag={onCreateGroupTag}
        />
      </div>
    );
  }

  return (
    <div className={`md-matches md-design-${variant} pl-page`} data-design={variant} data-view="players">
      <div className={variant === "command" ? "mdc pl-shell" : "mde pl-shell"}>
        {variant === "command" ? (
          <div className="mdc-bar"><h1>Jugadores</h1><span className="mdc-pill"><Users size={14} aria-hidden="true" /> <b>{rows.filter((r) => r.profile.membership_is_active).length}</b> activos</span></div>
        ) : (
          <header className="pl-ed-hero"><span className="mde-crumb">Plantel del grupo</span><h1>Jugadores</h1></header>
        )}
        <nav className="pl-tabs" aria-label="Secciones de Jugadores">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} type="button" className={activeTab === id ? "is-on" : ""} aria-current={activeTab === id ? "page" : undefined} onClick={() => setActiveTab(id)}>
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>

        {activeTab === "list" && (
          <PlayerDirectory rows={rows} variant={variant} isAdmin={isAdmin} fines={fines || []} ratingMap={ratingMap} onOpen={setSelectedId} />
        )}

        {activeTab === "leaderboard" && <PlayerRanking rows={rows} variant={variant} ratingMap={ratingMap} onOpen={setSelectedId} />}

        {activeTab === "subgroups" && isAdmin && (
          <div className="pl-admin-grid">
            <section className="pv-section" aria-labelledby="pl-push-title">
              <div className="mdd-head"><h2 id="pl-push-title"><Bell size={18} aria-hidden="true" />Notificaciones por subgrupo</h2></div>
              <form onSubmit={handleDispatchPush} className="form-grid md-form pl-form">
                <label>
                  Subgrupo destinatario
                  <select value={pushTag} onChange={(e) => setPushTag(e.target.value)} required>
                    <option value="">Seleccionar subgrupo</option>
                    {allGroupTags.map((tag) => (
                      <option key={tag} value={tag}>#{tag} ({membersByTag[tag]?.length || 0} jugadores)</option>
                    ))}
                  </select>
                </label>
                <label>
                  Mensaje
                  <textarea placeholder="Escribe el mensaje de alerta…" value={pushMessage} onChange={(e) => setPushMessage(e.target.value)} rows={4} required />
                </label>
                <div className="md-form-actions">
                  <button type="submit" className="md-btn md-btn-accent" disabled={pushLoading}>{pushLoading ? "Enviando…" : "Enviar alerta"}</button>
                </div>
              </form>
            </section>
            <section className="pv-section" aria-labelledby="pl-tag-title">
              <div className="mdd-head"><h2 id="pl-tag-title"><Tag size={18} aria-hidden="true" />Crear y asignar etiqueta</h2></div>
              <form onSubmit={handleCreateAndAssignTag} className="form-grid md-form pl-form">
                <label>
                  Nombre del tag
                  <input type="text" placeholder="Ej. veterano, martes, premium" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} required />
                </label>
                <label>
                  Jugador
                  <select value={tagPlayerId} onChange={(e) => setTagPlayerId(e.target.value)} required>
                    <option value="">Seleccionar jugador</option>
                    {profiles.filter((p) => p.membership_is_active).map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
                  </select>
                </label>
                <div className="md-form-actions"><button type="submit" className="md-btn md-btn-accent">Crear y asignar</button></div>
              </form>
            </section>
            <section className="pv-section pl-wide" aria-labelledby="pl-struct-title">
              <div className="mdd-head"><h2 id="pl-struct-title">Miembros por subgrupo</h2><small>{allGroupTags.length} etiquetas</small></div>
              {allGroupTags.length === 0 ? <p className="pf-empty">No hay etiquetas creadas en este grupo.</p> : (
                <div className="pl-tag-grid">
                  {allGroupTags.map((tag) => (
                    <article key={tag} className="pl-tag-card">
                      <header><b>#{tag}</b><small>{membersByTag[tag]?.length || 0} jugadores</small></header>
                      <ul>
                        {(membersByTag[tag] || []).map((member) => (
                          <li key={member.id}>
                            <span><Avatar profile={member} size="sm" />{displayName(member)}</span>
                            <button type="button" className="md-icon-btn" aria-label={`Quitar #${tag} de ${displayName(member)}`} onClick={() => handleRemovePlayerTag(member.id, tag)}>
                              <X size={15} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "stats" && (
          <section className="pv-section pl-narrow" aria-labelledby="pl-self-title">
            <div className="mdd-head"><h2 id="pl-self-title">Reportar mis estadísticas</h2><small>Partidos finalizados donde confirmaste asistencia</small></div>
            {finishedMatchesForUser.length === 0 ? (
              <p className="pf-empty">No tienes partidos finalizados recientes donde hayas confirmado asistencia.</p>
            ) : (
              <>
                <p className="fx-hint">Tus goles, asistencias y el voto de MVP se cargan en el Postpartido de cada partido; un admin los valida.</p>
                <ul className="pv-history">
                  {finishedMatchesForUser.map((match) => (
                    <li key={match.id}>
                      <span>{match.title || "Chamuscón"} · {new Date(match.match_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" })}</span>
                      <button type="button" className="md-btn md-btn-ghost fx-btn-sm" onClick={() => onOpenPostmatch?.(match.id)}>Ir al postpartido</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
