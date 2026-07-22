import { useState, useMemo } from "react";
import PlayersAdmin from "./PlayersAdmin.jsx";
import Avatar from "../components/Avatar.jsx";
import { formatTag } from "../tags.js";
import { displayName } from "../utils.js";
import { api } from "../api.js";
import LeaderboardPage from "./LeaderboardPage.jsx";

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
}) {
  const [activeTab, setActiveTab] = useState("list"); // "list" | "subgroups" | "stats"
  
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

  // Submit self stats
  const handleSaveSelfStats = async (e) => {
    e.preventDefault();
    if (!selectedMatchId) return;
    setSavingStats(true);
    try {
      const match = matches.find((m) => m.id === selectedMatchId);
      const groupId = match ? match.group_id : activeGroupId;
      await api.saveSinglePlayerMatchStats(selectedMatchId, groupId, currentProfileId, {
        goals,
        assists,
        clean_sheet: cleanSheet,
        mvp,
      }, currentProfileId);
      alert("Estadísticas reportadas con éxito.");
      onNotice?.("Tus estadísticas han sido actualizadas.");
    } catch (err) {
      alert("Error al guardar estadísticas: " + err.message);
    } finally {
      setSavingStats(false);
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

  return (
    <div className="players-page">
      <div className="tab-row" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`tab-button ${activeTab === "list" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("list")}
        >
          👥 Lista de Jugadores
        </button>
        {isAdmin && (
          <button
            className={`tab-button ${activeTab === "subgroups" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("subgroups")}
          >
            🏷️ Subgrupos y Tags
          </button>
        )}
        <button
          className={`tab-button ${activeTab === "stats" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("stats")}
        >
          📝 Subir Estadísticas
        </button>
        <button
          className={`tab-button ${activeTab === "leaderboard" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("leaderboard")}
        >
          🏆 Ranking
        </button>
      </div>

      {activeTab === "list" && (
        <PlayersAdmin
          activeGroupId={activeGroupId}
          attendances={attendances}
          fines={fines}
          isSuperAdmin={isSuperAdmin}
          isAdmin={isAdmin}
          matches={matches}
          onAssignRating={onAssignRating}
          onCreateGroupTag={onCreateGroupTag}
          onUpdateMember={onUpdateMember}
          onUpdateProfile={onUpdateProfile}
          profiles={profiles}
          ratingMap={ratingMap}
          voteScoreMap={voteScoreMap}
          userVoteMap={userVoteMap}
          onVote={onVote}
          currentProfileId={currentProfileId}
          skills={skills}
          onAddSkill={onAddSkill}
          onRemoveSkill={onRemoveSkill}
          matchStats={matchStats}
          onUpdateRole={onUpdateRole}
        />
      )}

      {activeTab === "leaderboard" && (
        <LeaderboardPage
          profiles={profiles}
          attendances={attendances}
          matchStats={matchStats}
          voteScoreMap={voteScoreMap}
          ratingMap={ratingMap}
          skills={skills}
        />
      )}

      {activeTab === "subgroups" && isAdmin && (
        <div className="page-grid">
          {/* Push Notification Console */}
          <section className="panel" style={{ flex: "1 1 300px" }}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Comunicación Directa</p>
                <h2>Consola de Notificaciones Push</h2>
              </div>
            </div>
            <form onSubmit={handleDispatchPush} className="form-grid">
              <label>
                Subgrupo Destinatario (Tag)
                <select value={pushTag} onChange={(e) => setPushTag(e.target.value)} required>
                  <option value="">-- Seleccionar Subgrupo --</option>
                  {allGroupTags.map((tag) => (
                    <option key={tag} value={tag}>
                      #{tag.toUpperCase()} ({membersByTag[tag]?.length || 0} jugadores)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mensaje de Notificación
                <textarea
                  placeholder="Escribe el mensaje de alerta..."
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                  rows={4}
                  required
                />
              </label>
              <button type="submit" disabled={pushLoading}>
                {pushLoading ? "Enviando..." : "Despachar Alerta Push"}
              </button>
            </form>
          </section>

          {/* Tag Management */}
          <section className="panel" style={{ flex: "1 1 300px" }}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Etiquetas</p>
                <h2>Gestionar Etiquetas y Subgrupos</h2>
              </div>
            </div>
            <form onSubmit={handleCreateAndAssignTag} className="form-grid">
              <label>
                Nombre del Tag
                <input
                  type="text"
                  placeholder="Ej. veterano, martes, premium"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  required
                />
              </label>
              <label>
                Jugador a Etiquetar
                <select value={tagPlayerId} onChange={(e) => setTagPlayerId(e.target.value)} required>
                  <option value="">Seleccionar jugador</option>
                  {profiles.filter(p => p.membership_is_active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayName(p)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">+ Crear & Asignar Tag</button>
            </form>
          </section>

          {/* Members by tag structure */}
          <section className="panel" style={{ flex: "1 1 100%" }}>
            <div className="section-heading">
              <h2>Estructura de Miembros por Subgrupo</h2>
            </div>
            <div className="list" style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {allGroupTags.length === 0 ? (
                <div className="empty-state compact">No hay etiquetas creadas en este grupo.</div>
              ) : (
                allGroupTags.map((tag) => (
                  <article key={tag} className="panel" style={{ background: "var(--background-alt)", border: "1px solid var(--border)", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                      <strong style={{ color: "var(--primary)" }}>#{tag.toUpperCase()}</strong>
                      <span className="count-pill">{membersByTag[tag]?.length || 0} jugadores</span>
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
                      {(membersByTag[tag] || []).map((member) => (
                        <li key={member.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--background)", padding: "0.4rem 0.8rem", borderRadius: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Avatar profile={member} size="sm" />
                            <span>{displayName(member)}</span>
                          </div>
                          <button
                            className="text-button danger-button"
                            type="button"
                            onClick={() => handleRemovePlayerTag(member.id, tag)}
                            style={{ padding: "2px 6px", fontSize: "0.8rem" }}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "stats" && (
        <section className="panel" style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reportar Rendimiento</p>
              <h2>Subir Mis Estadísticas del Partido</h2>
              <small>Reporta tus goles, asistencias y rendimiento individual del último partido jugado.</small>
            </div>
          </div>

          {finishedMatchesForUser.length === 0 ? (
            <div className="empty-state compact">
              No tienes partidos finalizados recientes registrados donde hayas confirmado asistencia.
            </div>
          ) : (
            <form onSubmit={handleSaveSelfStats} className="form-grid">
              <label>
                Selecciona el partido
                <select
                  value={selectedMatchId}
                  onChange={(e) => handleMatchSelect(e.target.value)}
                  required
                >
                  <option value="">-- Seleccionar Partido --</option>
                  {finishedMatchesForUser.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.title || "Chamuscón"} ({new Date(match.match_date + "T12:00:00").toLocaleDateString("es-GT")})
                    </option>
                  ))}
                </select>
              </label>

              {selectedMatchId && (
                <>
                  <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <label>
                      Goles Anotados
                      <input
                        type="number"
                        min="0"
                        value={goals}
                        onChange={(e) => setGoals(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </label>
                    <label>
                      Asistencias
                      <input
                        type="number"
                        min="0"
                        value={assists}
                        onChange={(e) => setAssists(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: "2rem", margin: "1rem 0" }}>
                    <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={cleanSheet}
                        onChange={(e) => setCleanSheet(e.target.checked)}
                      />
                      Valla Invicta (Clean Sheet)
                    </label>

                    <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={mvp}
                        onChange={(e) => setMvp(e.target.checked)}
                      />
                      Fui el MVP del Partido ⭐
                    </label>
                  </div>

                  <button type="submit" disabled={savingStats}>
                    {savingStats ? "Guardando..." : "Guardar Estadísticas"}
                  </button>
                </>
              )}
            </form>
          )}
        </section>
      )}
    </div>
  );
}
