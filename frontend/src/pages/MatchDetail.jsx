import AttendanceAction from "../components/AttendanceAction.jsx";
import { Check, X, Clock, UserPlus, Link2 } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import CourtPhoto from "../components/CourtPhoto.jsx";
import CopyReservationTextButton from "../components/CopyReservationTextButton.jsx";
import ExportCard from "../components/ExportCard.jsx";
import PostMatchSummaryCard from "../components/PostMatchSummaryCard.jsx";
import StarRatingControl from "../components/StarRatingControl.jsx";
import TeamCards from "../components/TeamCards.jsx";
import TeamShareCard from "../components/TeamShareCard.jsx";
import SocialShareCard from "../components/SocialShareCard.jsx";
import WeatherWidget from "../components/WeatherWidget.jsx";
import { distributeTeamsWithAI } from "../groq.js";
import { useEffect, useMemo, useState } from "react";
import { formatTag } from "../tags.js";
import {
  attendanceLabel,
  copyToClipboard,
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
    const link = api.generateGuestLink(match?.id);
    try {
      await copyToClipboard(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying guest link:", err);
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
  clearance,
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
  onBack,
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
          profile: p,
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
          match &&
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
  }, [confirmedPlayers, matchStats, match?.id]);

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
    if (!onSaveStats || !match?.id) return;
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
      .filter((s) => s && match && s.match_id === match.id)
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
  }, [matchStats, match?.id, profileById, guests]);

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
      const confirmationTimes = new Map();
      confirmedAttendances.forEach((a) => {
        confirmationTimes.set(a.profile_id, new Date(a.updated_at || a.created_at || Date.now()).getTime());
      });
      (guests || []).forEach((g) => {
        confirmationTimes.set(g.id, new Date(g.updated_at || g.created_at || Date.now()).getTime());
      });
      let players = [...registeredPlayers, ...guestPlayers].map((p) => ({
        ...p,
        confirmed_at: confirmationTimes.get(p.id) || Date.now(),
      }));

      const playerSkills = (skills || []).filter((s) => confirmedIds.includes(s.player_id));
      let teamCount = players.length >= 10 && players.length <= 13 ? 2 : (players.length >= 14 && players.length <= 18 ? 3 : Math.ceil(players.length / 5));

      let penaltyTeam = null;
      if (players.length === 14) {
        const sortedByTime = [...players].sort((a, b) => a.confirmed_at - b.confirmed_at);
        players = sortedByTime.slice(0, 10);
        penaltyTeam = sortedByTime.slice(10);
        teamCount = 2; // Pass only 2 teams to AI
      }

      const aiTeams = await distributeTeamsWithAI({
        players,
        skills: playerSkills,
        instructions: teamInstructions,
        teamCount,
      });

      if (penaltyTeam) {
        aiTeams.push({
          name: "Equipo C",
          playerIds: penaltyTeam.map((p) => p.id),
        });
        teamCount = 3;
        players = [...players, ...penaltyTeam];
      }

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
  const selectedVenue = (venues || []).find((venue) => venue && venue.id === match.venue_id)
    || (venues || []).find((venue) => venue && venue.name === match.venue)
    || null;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem", position: "relative" }}>
      {onBack && (
        <button
          onClick={onBack}
          className="ghost-button"
          style={{
            alignSelf: "flex-start",
            marginBottom: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            fontWeight: "500",
            padding: 0,
            background: "transparent",
            border: "none",
            cursor: "pointer"
          }}
        >
          ← Volver al Cartelero General
        </button>
      )}

      {/* ── TARJETA PREMIUM DE DETALLES ── */}
      <section className="match-premium-card" style={{
        background: "linear-gradient(135deg, #0b1320, #04080f)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        padding: "1.5rem",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Top Label & Badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{
            fontSize: "0.68rem",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--primary)"
          }}>
            Detalle de Convocatoria
          </span>
          <span style={{
            border: "1px solid rgba(16, 185, 129, 0.3)",
            padding: "0.15rem 0.5rem",
            borderRadius: "20px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: "rgba(16, 185, 129, 0.05)"
          }}>
            <Check size={12} /> {match.status === "upcoming" ? "Abierto a confirmaciones" : "Finalizado"}
          </span>
        </div>

        {/* Main Title */}
        <h1 style={{
          fontSize: "1.45rem",
          fontWeight: "500",
          color: "#ffffff",
          margin: "0 0 1.25rem 0",
          letterSpacing: "-0.01em"
        }}>
          {match.title || "Plaza 1 - Sintética"}
        </h1>

        {/* Grid Row for Details */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}>
          {/* Fecha */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: "12px",
            padding: "0.7rem 0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem"
          }}>
            <span style={{ fontSize: "1.2rem" }}>📅</span>
            <div>
              <span style={{ display: "block", fontSize: "0.62rem", color: "var(--muted)", fontWeight: "600", letterSpacing: "0.08em" }}>FECHA</span>
              <span style={{ fontSize: "0.85rem", color: "#ffffff", fontWeight: "500" }}>{formatMatchDate(match)}</span>
            </div>
          </div>

          {/* Hora */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: "12px",
            padding: "0.7rem 0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem"
          }}>
            <span style={{ fontSize: "1.2rem" }}>⏰</span>
            <div>
              <span style={{ display: "block", fontSize: "0.62rem", color: "var(--muted)", fontWeight: "600", letterSpacing: "0.08em" }}>HORA DE KICKOFF</span>
              <span style={{ fontSize: "0.85rem", color: "#ffffff", fontWeight: "500" }}>{match.start_time || "19:00 PM"}</span>
            </div>
          </div>

          {/* Quórum */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: "12px",
            padding: "0.7rem 0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem"
          }}>
            <span style={{ fontSize: "1.2rem" }}>👥</span>
            <div>
              <span style={{ display: "block", fontSize: "0.62rem", color: "var(--muted)", fontWeight: "600", letterSpacing: "0.08em" }}>QUÓRUM DEL PARTIDO</span>
              <span style={{ fontSize: "0.85rem", color: "#ffffff", fontWeight: "500" }}>{confirmedCount} / {match.max_players || 15}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "1.25rem 0" }} />

        {/* Call to action & button */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div>
            <span style={{ fontWeight: "500", color: "#ffffff", display: "block", fontSize: "0.9rem" }}>
              ¿Estás listo para jugar?
            </span>
            <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
              La cancelación tardía genera multa automática.
            </span>
          </div>

          {/* Confirmation Actions */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {myAttendance?.status === "confirmed" || myAttendance?.status === "checked_in" ? (
              <button
                onClick={onCancel}
                style={{
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "24px",
                  padding: "0.5rem 1.25rem",
                  fontWeight: "600",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                <X size={16} /> Cancelar Asistencia
              </button>
            ) : myAttendance?.status === "waitlist" ? (
              <button
                onClick={onCancel}
                style={{
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "24px",
                  padding: "0.5rem 1.25rem",
                  fontWeight: "600",
                  fontSize: "0.8rem",
                  gap: "0.4rem"
                }}
              >
                <Clock size={16} /> Salir de Lista de Espera
              </button>
            ) : isFullMatch(match, attendances) ? (
              <button
                onClick={onJoinWaitlist}
                style={{
                  background: "#f59e0b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "24px",
                  padding: "0.5rem 1.25rem",
                  fontWeight: "600",
                  fontSize: "0.8rem",
                  gap: "0.4rem"
                }}
              >
                <Clock size={16} /> Unirse a Lista de Espera
              </button>
            ) : (
              <button
                onClick={onConfirm}
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "24px",
                  padding: "0.5rem 1.25rem",
                  fontWeight: "600",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                <Check size={16} /> Confirmar Asistencia
              </button>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <>
            <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "1.25rem 0" }} />
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <button
                onClick={handleAIDistribute}
                disabled={aiLoading}
                style={{
                  background: "#3b82f6",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "24px",
                  padding: "0.6rem 1.25rem",
                  fontWeight: "600",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.3rem",
                  flex: 1,
                  minWidth: "200px"
                }}
              >
                {aiLoading ? "🤖 Pensando..." : "🤖 Generar equipos balanceados"}
              </button>
              <button
                onClick={() => setIsEditingStats((prev) => !prev)}
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "24px",
                  padding: "0.6rem 1.25rem",
                  fontWeight: "600",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.3rem",
                  flex: 1,
                  minWidth: "200px"
                }}
              >
                📝 Finalizar & Cargar stats
              </button>
            </div>
            {aiError && <p className="form-message" style={{ marginTop: "1rem" }}>{aiError}</p>}
          </>
        )}
      </section>

      {/* ── ACCIONES ADICIONALES DE ADMIN Y COMPARTIR ── */}
      {isAdmin && (
        <section className="panel" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", padding: "1rem" }}>
          {match.requires_reservation && (
            <div style={{ flex: "1", minWidth: "250px" }}>
              <CopyReservationTextButton
                match={match}
                attendances={attendances}
                profiles={profiles}
              />
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", flex: "1", justifyContent: "flex-end" }}>
            {confirmingDelete ? (
              <>
                <button className="danger-button" type="button" onClick={() => onDeleteMatch(match?.id)}>
                  Confirmar eliminar
                </button>
                <button className="secondary-button" type="button" onClick={() => setConfirmingDelete(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button className="danger-button" type="button" onClick={() => setConfirmingDelete(true)}>
                Eliminar partido
              </button>
            )}
          </div>
          {confirmingDelete && (
            <p className="confirm-delete-msg" style={{ width: "100%", margin: "0.5rem 0 0", color: "#ef4444" }}>
              ¿Eliminar "{match.title || "Chamuscón"}"? Se borran equipos, asistencias y cobros asociados.
            </p>
          )}
        </section>
      )}

      {/* ── COMPARTIR INVITACIÓN ── */}
      {isAdmin && (
        <div className="export-cards-grid" style={{ marginBottom: "1.5rem" }}>
          <ExportCard
            label="Invitación para WhatsApp"
            text={matchInvitationText(match, attendances)}
          />
          <SocialShareCard match={match} attendances={attendances} />
        </div>
      )}

      {/* ── PRONÓSTICO DEL CLIMA ── */}
      {match.match_date && (
        <section className="panel" style={{ marginTop: "0" }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow" style={{ color: "#10b981", fontSize: "0.65rem", letterSpacing: "0.08em" }}>PRONÓSTICO DEL CLIMA EXACTO</p>
              <h3 style={{ fontSize: "0.78rem", fontWeight: "normal", color: "var(--muted)", margin: "0.1rem 0 0" }}>
                {selectedVenue?.address || selectedVenue?.name || match.venue || "Guatemala"}
              </h3>
            </div>
            <span className="status-pill" style={{ background: "rgba(16, 185, 129, 0.05)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.15)", fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "15px" }}>
              ⛅ Clima Real
            </span>
          </div>
          <WeatherWidget
            venue={selectedVenue?.name || match.venue || "Guatemala"}
            date={match.match_date}
            time={match.start_time}
            lat={selectedVenue?.lat}
            lng={selectedVenue?.lng}
          />
        </section>
      )}

      {/* ── LISTA DE JUGADORES CONFIRMADOS ── */}
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow" style={{ color: "var(--primary)", fontSize: "0.65rem", letterSpacing: "0.08em" }}>Lista de Jugadores Confirmados</p>
            <h2 style={{ fontSize: "1rem", fontWeight: "500", margin: "0.1rem 0 0", color: "#ffffff" }}>
              {confirmedPlayers.length} Jugadores Confirmados ({confirmedPlayers.length} / {match.max_players || 15})
            </h2>
          </div>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "0.75rem",
          marginTop: "1rem"
        }}>
          {confirmedPlayers.map((cp, idx) => {
            const prefPos = cp.profile?.preferred_position ? (
              cp.profile.preferred_position.substring(0, 3).toUpperCase()
            ) : "JUG";
            const rating = ratingMap.get(cp.id)?.rating || 70;
            return (
              <div key={cp.id} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--surface-2)",
                padding: "0.65rem 0.9rem",
                borderRadius: "10px",
                border: "1px solid var(--border-light)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <Avatar profile={cp.is_guest ? null : cp.profile} size={32} />
                  <div>
                    <span style={{ fontWeight: "500", fontSize: "0.85rem", color: "#ffffff", display: "block", lineHeight: "1.2" }}>
                      {cp.name}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                      {prefPos} · OVR {rating}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: "0.78rem", color: "var(--primary)", fontWeight: "600" }}>
                  #{idx + 1}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── EQUIPOS ── */}
      <section className="panel">
        <div className="section-heading">
          <h2>Equipos</h2>
          <span className="count-pill">{(teams || []).length}</span>
        </div>
        {(teams || []).length === 0 ? (
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
              <div className="export-cards-grid" style={{ marginTop: "1rem" }}>
                <ExportCard
                  label="Equipos para WhatsApp"
                  text={teamAnnouncementText(match, teams)}
                />
                <ExportCard
                  label="Notificar equipos a jugadores"
                  text={teamNotificationText(match, teams)}
                />
                <TeamShareCard match={match} teams={teams} />
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
                const player = profileById?.get(attendance.profile_id);
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
      {(() => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const canShowStats = match?.status === "closed" || (match?.match_date && match.match_date <= today);
        return canShowStats ? (
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
              <>
              <PostMatchSummaryCard
                match={match}
                stats={currentMatchStats}
                confirmedCount={confirmedCount}
              />
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
              </>
            )}
          </section>
        ) : null;
      })()}
      {/* Floating Action Button for sharing guest link */}
      <button
        onClick={async () => {
          const link = api.generateGuestLink(match?.id);
          try {
            await copyToClipboard(link);
            alert("Enlace de invitado copiado al portapapeles ✓");
          } catch (err) {}
        }}
        title="Copiar enlace para invitados"
        style={{
          position: "fixed",
          bottom: "80px", // above mobile bottom nav
          right: "20px",
          width: "56px",
          height: "56px",
          borderRadius: "28px",
          background: "var(--primary)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 15px rgba(16,185,129,0.4)",
          border: "none",
          cursor: "pointer",
          zIndex: 999
        }}
      >
        <Link2 size={24} />
      </button>
    </div>
  );
}
