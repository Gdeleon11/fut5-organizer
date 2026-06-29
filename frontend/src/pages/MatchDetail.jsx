import AttendanceAction from "../components/AttendanceAction.jsx";
import CourtPhoto from "../components/CourtPhoto.jsx";
import CopyReservationTextButton from "../components/CopyReservationTextButton.jsx";
import ExportCard from "../components/ExportCard.jsx";
import StarRatingControl from "../components/StarRatingControl.jsx";
import TeamCards from "../components/TeamCards.jsx";
import WeatherWidget from "../components/WeatherWidget.jsx";
import { distributeTeamsWithAI } from "../groq.js";
import { useEffect, useState } from "react";
import { formatTag } from "../tags.js";
import {
  attendanceLabel,
  displayName,
  formatMatchDate,
  isFullMatch,
  matchInvitationText,
  teamAnnouncementText,
  teamNotificationText,
  waitlistPosition,
} from "../utils.js";

import { api } from "../api.js";
import { generateBalancedTeams } from "../teamGeneration.js";

function GuestPlayersSection({ match, guests = [], onAdd, onDelete, onUpdateRating }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(2);
  const [copied, setCopied] = useState(false);

  function handleAdd() {
    if (!name.trim()) return;
    onAdd(name.trim(), rating);
    setName("");
    setRating(2);
    setShowForm(false);
  }

  async function copyGuestLink() {
    const link = api.generateGuestLink(match.id);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copiá este link:", link);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Jugadores invitados</h2>
          <small>Temporal solo para este partido</small>
        </div>
        <div className="button-row">
          <span className="count-pill">{(guests || []).length}</span>
          <button
            className="secondary-button"
            type="button"
            onClick={copyGuestLink}
          >
            {copied ? "Copiado ✓" : "Link de invitación"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancelar" : "+ Agregar"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-grid">
          <label>
            Nombre del jugador
            <input
              placeholder="Ej. Juan (amigo de Pedro)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Calificación
            <StarRatingControl currentRating={rating} onSelect={setRating} />
          </label>
          <button type="button" onClick={handleAdd} disabled={!name.trim()}>
            Agregar invitado
          </button>
        </div>
      )}

      {(guests || []).length === 0 && !showForm ? (
        <div className="empty-state compact">No hay jugadores invitados.</div>
      ) : (
        <div className="player-list">
          {(guests || []).map((guest) => (
            <div className="player-row" key={guest.id}>
              <div>
                <strong>{guest.name}</strong>
                <div className="guest-rating-row">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      className={`guest-rating-btn ${guest.rating === n ? "is-active" : ""}`}
                      type="button"
                      onClick={() => onUpdateRating(guest.id, n)}
                    >
                      {n}★
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => onDelete(guest.id)}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MatchDetail({
  confirmedCount,
  fineAmount,
  isAdmin,
  match,
  myAttendance,
  onCheckIn,
  onConfirm,
  onCancel,
  onJoinWaitlist,
  onDeleteMatch,
  onGenerateTeams,
  onMarkNoShow,
  onAddGuest,
  onDeleteGuest,
  onUpdateGuestRating,
  attendances = [],
  guests = [],
  profile,
  profiles = [],
  profileById,
  skills,
  ratingMap,
  teams,
  venues = [],
  matchStats = [],
  onSaveStats,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [teamInstructions, setTeamInstructions] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [statsForm, setStatsForm] = useState([]);
  const [savingStats, setSavingStats] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);

  // Get all confirmed players for the stats editor
  const confirmedPlayers = useMemo(() => {
    const regularConfirmed = (attendances || [])
      .filter((a) => ["confirmed", "checked_in"].includes(a.status))
      .map((a) => {
        const p = profileById?.get(a.profile_id);
        return {
          id: a.profile_id,
          name: p ? displayName(p) : "Jugador",
          is_guest: false,
        };
      });

    const guestPlayers = (guests || []).map((g) => ({
      id: g.id,
      name: g.name,
      is_guest: true,
    }));

    return [...regularConfirmed, ...guestPlayers];
  }, [attendances, guests, profileById]);

  // Initialize stats form state
  useEffect(() => {
    const initialStats = confirmedPlayers.map((player) => {
      const existing = (matchStats || []).find(
        (s) =>
          s &&
          s.match_id === match.id &&
          (player.is_guest
            ? s.guest_player_id === player.id
            : s.player_id === player.id)
      );

      return {
        player_id: player.is_guest ? null : player.id,
        guest_player_id: player.is_guest ? player.id : null,
        name: player.name,
        is_guest: player.is_guest,
        goals: existing ? existing.goals : 0,
        assists: existing ? existing.assists : 0,
        mvp: existing ? existing.mvp : false,
        clean_sheet: existing ? existing.clean_sheet : false,
      };
    });
    setStatsForm(initialStats);
  }, [confirmedPlayers, matchStats, match.id]);

  const updateStatField = (playerId, isGuest, field, value) => {
    setStatsForm((prev) =>
      prev.map((item) => {
        const isMatch = isGuest
          ? item.guest_player_id === playerId
          : item.player_id === playerId;
        if (!isMatch) return item;
        return { ...item, [field]: value };
      }).map((item) => {
        // Enforce only one MVP
        if (field === "mvp" && value === true) {
          const isThis = isGuest
            ? item.guest_player_id === playerId
            : item.player_id === playerId;
          if (!isThis) {
            return { ...item, mvp: false };
          }
        }
        return item;
      })
    );
  };

  const handleSaveStats = async () => {
    if (!onSaveStats) return;
    setSavingStats(true);
    try {
      await onSaveStats(match.id, statsForm);
      alert("Estadísticas guardadas con éxito.");
      setIsEditingStats(false);
    } finally {
      setSavingStats(false);
    }
  };

  // Match stats for this specific match
  const currentMatchStats = useMemo(() => {
    return (matchStats || [])
      .filter((s) => s && s.match_id === match.id)
      .map((s) => {
        let name = "Jugador";
        if (s.player_id) {
          const p = profileById?.get(s.player_id);
          name = p ? displayName(p) : "Jugador";
        } else if (s.guest_player_id) {
          const g = (guests || []).find((guest) => guest.id === s.guest_player_id);
          name = g ? g.name : "Invitado";
        }
        return {
          ...s,
          name,
        };
      })
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || (b.mvp ? 1 : 0) - (a.mvp ? 1 : 0));
  }, [matchStats, match.id, profileById, guests]);

  async function handleAIDistribute() {
    setAiError("");
    setAiLoading(true);
    try {
      const confirmedAttendances = (attendances || []).filter(
        (a) => a && (a.status === "confirmed" || a.status === "checked_in")
      );
      const confirmedIds = confirmedAttendances.map((a) => a.profile_id);
      const registeredPlayers = profileById
        ? Array.from(profileById.values()).filter(
            (p) => p.membership_is_active && confirmedIds.includes(p.id),
          )
        : [];
      const guestPlayers = (guests || []).map((g) => ({
        id: g.id,
        full_name: g.name,
        nickname: null,
        preferred_position: "Flexible",
        membership_is_active: true,
        is_guest: true,
        rating: g.rating || 2,
        attack_rating: g.rating || 2,
        defense_rating: g.rating || 2,
        midfield_rating: g.rating || 2,
        goalkeeper_rating: g.rating || 2,
      }));
      const players = [...registeredPlayers, ...guestPlayers];
      const playerSkills = (skills || []).filter((s) => confirmedIds.includes(s.player_id));
      const teamCount = Math.ceil(players.length / 5);

      const aiTeams = await distributeTeamsWithAI({
        players,
        skills: playerSkills,
        instructions: teamInstructions,
        teamCount,
      });

      const flatAssignedIds = aiTeams.flatMap((team) => team.playerIds || team.player_ids || []);
      const assignedIds = new Set(flatAssignedIds);
      const isValid = players.length >= 10
        && aiTeams.length === teamCount
        && flatAssignedIds.length === players.length
        && assignedIds.size === players.length
        && players.every((player) => assignedIds.has(player.id));
      if (!isValid) {
        const fallback = generateBalancedTeams(players);
        onGenerateTeams({ aiTeams: { teams: fallback.teams.map((team) => ({
          name: team.name,
          playerIds: team.players.map((player) => player.id),
        })), team_count: fallback.team_count }, aiFallback: true });
        setAiError("La IA devolvió equipos incompletos; usé distribución automática con todos los confirmados.");
        return;
      }

      onGenerateTeams({ aiTeams: { teams: aiTeams, team_count: aiTeams.length } });
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  const canPenaltyTeam = confirmedCount >= 13 && confirmedCount <= 14;
  const isPlayerConfirmed = myAttendance && ["confirmed", "checked_in"].includes(myAttendance.status);
  const selectedVenue = venues.find((venue) => venue.id === match.venue_id)
    || venues.find((venue) => venue.name === match.venue)
    || null;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Detalle del partido</p>
            <h2>{match.title || "Chamuscón"}</h2>
          </div>
          <span className="count-pill">{confirmedCount} confirmados</span>
        </div>
        <p className="muted">
          {formatMatchDate(match)}
          {(isAdmin || isPlayerConfirmed) && match.venue
            ? ` · ${match.venue}`
            : " · Cancha oculta (confirmá para ver)"}
        </p>
        {match.allowed_tags?.length > 0 && (
          <div className="tag-list">
            {match.allowed_tags.map((tag) => (
              <span className="tag-chip is-readonly" key={tag}>{formatTag(tag)}</span>
            ))}
          </div>
        )}
        {match.requires_reservation && (
          <div className="reservation-copy-inline">
            <CopyReservationTextButton
              match={match}
              attendances={attendances}
              profiles={profiles}
            />
          </div>
        )}
        {(isAdmin || isPlayerConfirmed) && <CourtPhoto match={match} />}
        {match.match_date && (
          <WeatherWidget
            venue={selectedVenue?.name || match.venue || "Guatemala"}
            date={match.match_date}
            time={match.start_time}
            lat={selectedVenue?.lat}
            lng={selectedVenue?.lng}
          />
        )}
        <AttendanceAction
          attendance={myAttendance}
          fineAmount={fineAmount}
          match={match}
          isFull={isFullMatch(match, attendances)}
          waitlistPos={waitlistPosition(match.id, profile?.id, attendances)}
          onConfirm={onConfirm}
          onJoinWaitlist={onJoinWaitlist}
          onCancel={onCancel}
          profile={profile}
        />
        {isAdmin && (
          <>
            <div className="team-instructions-box">
              <label>
                <small>Instrucciones para generar equipos (opcional)</small>
                <textarea
                  rows={3}
                  placeholder="Ej: Juan con Pedro juntos, Luis portero en equipo de Guillermo, Carlos y Diego separados..."
                  value={teamInstructions}
                  onChange={(e) => setTeamInstructions(e.target.value)}
                />
              </label>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => onGenerateTeams({ instructions: teamInstructions })} disabled={aiLoading}>
                Generar equipos
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={handleAIDistribute}
                disabled={aiLoading}
                title="Usa Groq AI para distribuir equipos considerando skills e instrucciones"
              >
                {aiLoading ? "🤖 Pensando..." : "🤖 Distribuir con IA"}
              </button>
              {canPenaltyTeam && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onGenerateTeams({ penaltyTeam: true, instructions: teamInstructions })}
                  title="Crea un equipo pequeño con los últimos 3 en confirmar"
                >
                  Con equipo de castigo
                </button>
              )}
            {aiError && <p className="form-message">{aiError}</p>}
            {confirmingDelete ? (
              <>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => onDeleteMatch(match.id)}
                >
                  Confirmar eliminar
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                className="danger-button"
                type="button"
                onClick={() => setConfirmingDelete(true)}
              >
                Eliminar partido
              </button>
            )}
            {aiError && <p className="form-message">{aiError}</p>}
          </div>
          </>
        )}
        {confirmingDelete && (
          <p className="confirm-delete-msg">
            ¿Eliminar "{match.title || "Chamuscón"}"? Se borran equipos,
            asistencias y cobros asociados.
          </p>
        )}
        <ExportCard
          label="Invitación para WhatsApp"
          text={matchInvitationText(match, confirmedCount)}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Equipos</h2>
          <span className="count-pill">{teams.length}</span>
        </div>
        {teams.length === 0 ? (
          <div className="empty-state compact">
            Los equipos aparecerán cuando un admin los genere.
          </div>
        ) : (
          <>
            <TeamCards
              teams={teams}
              isAdmin={isAdmin}
              ratingMap={ratingMap}
              skills={skills}
              matchStats={matchStats}
            />
            {isAdmin && (
              <div className="export-cards-grid">
                <ExportCard
                  label="Equipos para WhatsApp"
                  text={teamAnnouncementText(match, teams)}
                />
                <ExportCard
                  label="Notificar equipos a jugadores"
                  text={teamNotificationText(match, teams)}
                />
              </div>
            )}
          </>
        )}
      </section>

      {isAdmin && (
        <section className="panel">
          <div className="section-heading">
            <h2>Asistencia</h2>
            <span className="count-pill">{(attendances || []).length}</span>
          </div>
          <div className="player-list">
            {(attendances || []).length === 0 ? (
              <div className="empty-state compact">Aún no hay confirmaciones.</div>
            ) : (
              (attendances || []).map((attendance) => {
                const player = profileById.get(attendance.profile_id);
                return (
                  <div className="player-row" key={attendance.id}>
                    <div>
                      <strong>{displayName(player)}</strong>
                      <small>
                        {attendanceLabel(
                          attendance.status,
                          attendance.checked_in,
                        )}
                      </small>
                    </div>
                    <div className="button-row">
                      <button
                        className="secondary-button"
                        disabled={attendance.checked_in}
                        type="button"
                        onClick={() => onCheckIn(attendance)}
                      >
                        Registrar
                      </button>
                      <button
                        disabled={attendance.status === "no_show"}
                        type="button"
                        onClick={() => onMarkNoShow(attendance)}
                      >
                        No llegó
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {isAdmin && (
        <GuestPlayersSection
          match={match}
          guests={guests}
          onAdd={onAddGuest}
          onDelete={onDeleteGuest}
          onUpdateRating={onUpdateGuestRating}
        />
      )}

      {/* Panel de Estadísticas del Partido (solo si el partido está cerrado/jugado) */}
      {match.status === "closed" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Estadísticas del Partido</h2>
              <small>Goles, asistencias, jugador del partido (MVP) y valla invicta.</small>
            </div>
            {isAdmin && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIsEditingStats((prev) => !prev)}
              >
                {isEditingStats ? "Cancelar" : "Editar Estadísticas"}
              </button>
            )}
          </div>

          {isEditingStats && isAdmin ? (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div className="list" style={{ display: "grid", gap: "0.75rem" }}>
                {statsForm.map((row) => {
                  const pId = row.is_guest ? row.guest_player_id : row.player_id;
                  return (
                    <div
                      key={`${row.is_guest ? 'g' : 'p'}-${pId}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem 0.75rem",
                        background: "var(--surface-2)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-light)",
                        gap: "0.5rem",
                        flexWrap: "wrap"
                      }}
                    >
                      <strong style={{ minWidth: "120px", flex: "1" }}>
                        {row.name} {row.is_guest && <span className="tag-chip is-readonly" style={{ fontSize: "0.7rem", padding: "0.1rem 0.3rem" }}>invitado</span>}
                      </strong>

                      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                        {/* Goles */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <span title="Goles">⚽</span>
                          <input
                            type="number"
                            min="0"
                            value={row.goals}
                            onChange={(e) =>
                              updateStatField(pId, row.is_guest, "goals", parseInt(e.target.value) || 0)
                            }
                            style={{
                              width: "50px",
                              padding: "0.25rem",
                              textAlign: "center",
                              fontSize: "0.85rem",
                              height: "auto",
                              minHeight: "auto"
                            }}
                          />
                        </div>

                        {/* Asistencias */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <span title="Asistencias">👟</span>
                          <input
                            type="number"
                            min="0"
                            value={row.assists}
                            onChange={(e) =>
                              updateStatField(pId, row.is_guest, "assists", parseInt(e.target.value) || 0)
                            }
                            style={{
                              width: "50px",
                              padding: "0.25rem",
                              textAlign: "center",
                              fontSize: "0.85rem",
                              height: "auto",
                              minHeight: "auto"
                            }}
                          />
                        </div>

                        {/* MVP */}
                        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.85rem", userSelect: "none" }}>
                          <input
                            type="checkbox"
                            checked={row.mvp}
                            onChange={(e) =>
                              updateStatField(pId, row.is_guest, "mvp", e.target.checked)
                            }
                          />
                          👑 MVP
                        </label>

                        {/* Valla Invicta */}
                        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.85rem", userSelect: "none" }}>
                          <input
                            type="checkbox"
                            checked={row.clean_sheet}
                            onChange={(e) =>
                              updateStatField(pId, row.is_guest, "clean_sheet", e.target.checked)
                            }
                          />
                          🧤 Valla
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={savingStats}
                onClick={handleSaveStats}
                style={{ width: "100%" }}
              >
                {savingStats ? "Guardando..." : "Guardar Estadísticas"}
              </button>
            </div>
          ) : (
            <div className="list">
              {currentMatchStats.length === 0 ? (
                <div className="empty-state compact">
                  Aún no se han registrado las estadísticas de este partido.
                </div>
              ) : (
                currentMatchStats.map((stat) => (
                  <div
                    key={stat.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid var(--border-light)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong>{stat.name}</strong>
                      {stat.is_guest && <span className="tag-chip is-readonly" style={{ fontSize: "0.7rem", padding: "0.1rem 0.3rem" }}>invitado</span>}
                      {stat.mvp && <span title="Jugador del Partido (MVP)" style={{ fontSize: "1.2rem" }}>👑</span>}
                      {stat.clean_sheet && <span title="Valla Invicta" style={{ fontSize: "1.2rem" }}>🧤</span>}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      {stat.goals > 0 && <span style={{ marginRight: "0.75rem" }}>⚽ <strong>{stat.goals}</strong> {stat.goals === 1 ? "gol" : "goles"}</span>}
                      {stat.assists > 0 && <span>👟 <strong>{stat.assists}</strong> {stat.assists === 1 ? "asistencia" : "asistencias"}</span>}
                      {stat.goals === 0 && stat.assists === 0 && <span className="muted" style={{ fontSize: "0.8rem" }}>Participó</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
