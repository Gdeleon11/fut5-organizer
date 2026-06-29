import AttendanceAction from "../components/AttendanceAction.jsx";
import CourtPhoto from "../components/CourtPhoto.jsx";
import ExportCard from "../components/ExportCard.jsx";
import MatchForm from "../components/MatchForm.jsx";
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
  guests = {},
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [activeTab, setActiveTab] = useState("upcoming"); // "upcoming" or "past"
  const venueById = new Map((venues || []).map((venue) => venue && [venue.id, venue]).filter(Boolean));

  function matchConfirmedCount(matchId) {
    const regularConfirmed = (matchAttendances(matchId) || []).filter(isConfirmedAttendance).length;
    const guestList = (guests || {})[matchId] || [];
    return regularConfirmed + guestList.length;
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
  const currentList = activeTab === "upcoming" ? upcomingExcludingNext : (pastMatches || []);

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Siguiente partido</p>
            <h2>{nextMatch ? formatMatchDate(nextMatch) : "Sin partidos"}</h2>
          </div>
          {nextMatch && (
            <span className="count-pill">
              {matchConfirmedCount(nextMatch.id)} confirmados
            </span>
          )}
        </div>

        {nextMatch ? (
          <>
            {(() => {
              const nextAtt = myAttendance(nextMatch.id);
              const isConfirmed = nextAtt && ["confirmed", "checked_in"].includes(nextAtt.status);
              const nextVenue = matchVenue(nextMatch);
              return (
                <>
                  {isConfirmed && <CourtPhoto match={nextMatch} />}
                  {nextMatch.match_date && (
                    <WeatherWidget
                      venue={nextVenue?.name || nextMatch.venue || "Guatemala"}
                      date={nextMatch.match_date}
                      time={nextMatch.start_time}
                      lat={nextVenue?.lat}
                      lng={nextVenue?.lng}
                    />
                  )}
                  <p className="muted">
                    {isConfirmed
                      ? (nextMatch.venue || "Cancha pendiente")
                      : "Confirmá para ver la cancha"}
                  </p>
                </>
              );
            })()}
            <AttendanceAction
              attendance={myAttendance(nextMatch.id)}
              fineAmount={fineAmount}
              match={nextMatch}
              isFull={isFullMatch(nextMatch, attendances)}
              waitlistPos={waitlistPosition(nextMatch.id, profile?.id, attendances)}
              onConfirm={() => onConfirm(nextMatch)}
              onJoinWaitlist={() => onJoinWaitlist(nextMatch)}
              onCancel={() => onCancel(nextMatch)}
              profile={profile}
            />
            <div className="button-row">
              <button type="button" onClick={() => onOpenMatch(nextMatch.id)}>
                Abrir partido
              </button>
            </div>
            <ExportCard
              label="Invitación para WhatsApp"
              text={matchInvitationText(
                nextMatch,
                matchConfirmedCount(nextMatch.id),
              )}
            />
          </>
        ) : (
          <div className="empty-state compact">
            Todavía no hay partidos creados.
          </div>
        )}
      </section>

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

        <div className="tab-row">
          <button
            className={`tab-button ${activeTab === "upcoming" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("upcoming")}
          >
            Próximos ({upcomingExcludingNext.length})
          </button>
          <button
            className={`tab-button ${activeTab === "past" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("past")}
          >
            Pasados ({(pastMatches || []).length})
          </button>
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
              {activeTab === "upcoming" ? "No hay próximos partidos." : "No hay partidos pasados."}
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
