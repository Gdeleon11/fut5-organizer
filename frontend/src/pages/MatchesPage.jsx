import AttendanceAction from "../components/AttendanceAction.jsx";
import CourtPhoto from "../components/CourtPhoto.jsx";
import ExportCard from "../components/ExportCard.jsx";
import MatchForm from "../components/MatchForm.jsx";
import SocialShareCard from "../components/SocialShareCard.jsx";
import WeatherWidget from "../components/WeatherWidget.jsx";
import { useState } from "react";
import { formatTag } from "../tags.js";
import {
  formatMatchDate,
  isConfirmedAttendance,
  isFullMatch,
  matchInvitationText,
  waitlistPosition,
} from "../utils.js";

export default function MatchesPage({
  attendances,
  isAdmin,
  matchAttendances,
  matches,
  pastMatches = [],
  myAttendance,
  nextMatch,
  onCancel,
  onConfirm,
  onJoinWaitlist,
  onCreateMatch,
  onDeleteMatch,
  onOpenMatch,
  profile,
  fineAmount,
  venues,
  profiles = [],
  groupTags = [],
  onCreateGroupTag,
  onNotice,
  clearance,
  guests = {},
  onOpenPizarra,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const venueById = new Map((venues || []).map((venue) => venue && [venue.id, venue]).filter(Boolean));

  function matchConfirmedCount(matchId) {
    const regularConfirmed = (matchAttendances(matchId) || []).filter(isConfirmedAttendance).length;
    const guestList = (guests || {})[matchId] || [];
    return regularConfirmed + guestList.length;
  }

  function matchWaitlist(matchId) {
    return (matchAttendances(matchId) || [])
      .filter((attendance) => attendance && attendance.status === "waitlist")
      .map((attendance) => profiles.find((p) => p.id === attendance.profile_id))
      .filter(Boolean);
  }

  function waitlistText(match) {
    const waiting = matchWaitlist(match.id);
    const confirmed = matchConfirmedCount(match.id);
    const maxPlayers = Number(match.max_players || 0);
    return [
      "ESTADO F5MANAGER",
      "",
      match.title || "Chamuscón",
      `Cuándo: ${formatMatchDate(match)}`,
      `Cupos: ${confirmed}/${maxPlayers || "sin límite"}`,
      waiting.length > 0
        ? `Lista de espera: ${waiting.map((p) => p.nickname || p.full_name).join(", ")}`
        : "Lista de espera: vacía",
      "",
      "Avisen si alguien libera cupo.",
    ].join("\n");
  }

  function matchVenue(match) {
    return venueById.get(match?.venue_id) || (venues || []).find((venue) => venue && venue.name === match?.venue) || null;
  }

  async function handleCreate(payload, photoFile) {
    const created = await onCreateMatch(payload, photoFile);
    if (created) setShowCreate(false);
  }

  async function handleDelete(matchId) {
    await onDeleteMatch(matchId);
    setDeletingId(null);
  }

  const upcomingExcludingNext = (matches || []).filter((m) => nextMatch ? m.id !== nextMatch.id : true);
  const currentList = pastMatches || [];

  return (
    <div className="page-grid">
      {/* ── Cartelera de Partidos Header ── */}
      <div className="section-heading" style={{ gridColumn: "1 / -1", marginBottom: "1rem" }}>
        <div>
          <p className="eyebrow" style={{ color: "var(--primary)" }}>Cartelera de Partidos</p>
          <h2 className="page-lede" style={{ fontWeight: "normal", margin: "0.25rem 0 0" }}>
            Explorá partidos, registrate, convocá, convocados e historial del grupo
          </h2>
        </div>
        <div className="button-row">
          {isAdmin && (
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={onOpenPizarra}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                📋 Pizarra Táctica
              </button>
              <button
                className={showCreate ? "secondary-button" : ""}
                type="button"
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? "Cancelar" : "+ Nuevo Partido"}
              </button>
            </>
          )}
        </div>
      </div>

      {showCreate && isAdmin && (
        <div style={{ gridColumn: "1 / -1", marginBottom: "1.5rem" }}>
          <MatchForm
            venues={venues}
            profiles={profiles}
            attendances={attendances}
            groupTags={groupTags}
            onCreateGroupTag={onCreateGroupTag}
            onCopied={onNotice}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* ── Siguiente Partido Tarjeta Premium ── */}
      {nextMatch ? (
        <section className="next-match-card-premium" style={{ gridColumn: "1 / -1" }}>
          <div className="next-match-badge">PRÓXIMO PARTIDO MÁS CERCANO</div>
          <div className="next-match-premium-header">
            <h3>{nextMatch.title || nextMatch.venue || "Chamuscón"}</h3>
            <div className="next-match-datetime-pill">
              📅 {formatMatchDate(nextMatch)}
            </div>
          </div>
          
          <div className="next-match-location">
            📍 {nextMatch.venue || "Lugar reservado"}
          </div>

          <div className="next-match-progress-container">
            <div className="next-match-progress-label">
              <span>Quórum del partido</span>
              <span>{matchConfirmedCount(nextMatch.id)}/{nextMatch.max_players || 15} convocados</span>
            </div>
            <div className="next-match-progress-bar-bg">
              <div
                className="next-match-progress-bar-fill"
                style={{
                  width: `${Math.min(100, Math.round((matchConfirmedCount(nextMatch.id) / (nextMatch.max_players || 15)) * 100))}%`
                }}
              />
            </div>
          </div>

          <div className="next-match-footer">
            <div className="next-match-info-text">
              {matchConfirmedCount(nextMatch.id) >= (nextMatch.max_players || 15) ? (
                <span>⚠️ Convocatoria llena. Anótate en lista de espera.</span>
              ) : (
                <span>ⓘ Convocatoria abierta para el equipo. ¡Súmate ahora!</span>
              )}
            </div>
            <button
              type="button"
              className="next-match-action-btn"
              onClick={() => onOpenMatch(nextMatch.id)}
            >
              Entrar y confirmar asistencia →
            </button>
          </div>
        </section>
      ) : (
        <section className="panel" style={{ gridColumn: "1 / -1" }}>
          <div className="empty-state compact">
            Todavía no hay partidos creados.
          </div>
        </section>
      )}

      {/* ── Siguientes Partidos Programados ── */}
      {upcomingExcludingNext.length > 0 && (
        <section className="panel" style={{ gridColumn: "1 / -1", marginBottom: "1.5rem" }}>
          <div className="section-heading" style={{ marginBottom: "1rem" }}>
            <h2>Siguientes partidos programados</h2>
          </div>
          <div className="list" style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {upcomingExcludingNext.map((match) => (
              <article
                key={match.id}
                className="panel"
                style={{
                  background: "var(--background-alt)",
                  border: "1px solid var(--border)",
                  padding: "1rem",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem"
                }}
              >
                <div>
                  <span className="status-pill is-pending" style={{ marginBottom: "0.5rem" }}>PRÓXIMO</span>
                  <h4 style={{ margin: 0, fontSize: "1.1rem" }}>{match.title || match.venue || "Chamuscón"}</h4>
                  <small style={{ color: "var(--muted)", display: "block", marginTop: "0.2rem" }}>
                    📅 {formatMatchDate(match)}
                  </small>
                  <small style={{ color: "var(--text-secondary)", display: "block", marginTop: "0.4rem" }}>
                    📍 {match.venue || "Lugar pendiente"}
                  </small>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="count-pill">{matchConfirmedCount(match.id)} confirmados</span>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onOpenMatch(match.id)}
                    style={{ padding: "4px 10px", fontSize: "0.85rem", minHeight: "auto" }}
                  >
                    Ver Detalles
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-heading" style={{ marginBottom: "0.5rem" }}>
          <h2>Historial de Partidos</h2>
          {isAdmin && (
            <button
              className={showCreate ? "secondary-button" : ""}
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              style={{ minHeight: "auto", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              {showCreate ? "Cancelar" : "+ Nuevo partido"}
            </button>
          )}
        </div>

        {showCreate && isAdmin && (
          <MatchForm
            venues={venues}
            profiles={profiles}
            attendances={attendances}
            groupTags={groupTags}
            onCreateGroupTag={onCreateGroupTag}
            onCopied={onNotice}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        )}

        <div className="list">
          {currentList.length === 0 ? (
            <div className="empty-state compact">
              No hay partidos pasados.
            </div>
          ) : (
            currentList.map((match) => (
              <div className="match-row-wrapper" key={match.id}>
                <button
                  className="match-row"
                  type="button"
                  onClick={() => onOpenMatch(match.id)}
                >
                  <span>
                    <strong>{match.title || "Chamuscón"}</strong>
                    <small>{formatMatchDate(match)}</small>
                    {match && (match.allowed_tags || []).length > 0 && (
                      <span className="tag-list compact">
                        {(match.allowed_tags || []).map((tag) => (
                          <span className="tag-chip is-readonly" key={tag}>{formatTag(tag)}</span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="count-pill">
                    {matchConfirmedCount(match.id)}
                  </span>
                </button>
                {isAdmin && (
                  <div className="match-row-actions">
                    {deletingId === match.id ? (
                      <>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => handleDelete(match.id)}
                        >
                          Confirmar
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setDeletingId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => setDeletingId(match.id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
                {deletingId === match.id && (
                  <p className="confirm-delete-msg">
                    ¿Eliminar "{match.title || "Chamuscón"}"? Se borran equipos,
                    asistencias y cobros asociados.
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
