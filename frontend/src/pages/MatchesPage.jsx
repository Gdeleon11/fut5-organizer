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
  const venueById = new Map(venues.map((venue) => [venue.id, venue]));

  function matchConfirmedCount(matchId) {
    const regularConfirmed = matchAttendances(matchId).filter(isConfirmedAttendance).length;
    const guestList = guests[matchId] || [];
    return regularConfirmed + guestList.length;
  }

  function matchVenue(match) {
    return venueById.get(match?.venue_id) || venues.find((venue) => venue.name === match?.venue) || null;
  }

  async function handleCreate(payload, photoFile) {
    const created = await onCreateMatch(payload, photoFile);
    if (created) setShowCreate(false);
  }

  async function handleDelete(matchId) {
    await onDeleteMatch(matchId);
    setDeletingId(null);
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Próximo partido</p>
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
        <div className="section-heading">
          <h2>Próximos partidos</h2>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className="count-pill">{matches.length}</span>
            {isAdmin && (
              <button
                className={showCreate ? "secondary-button" : ""}
                type="button"
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? "Cancelar" : "+ Nuevo partido"}
              </button>
            )}
          </div>
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
          {matches.length === 0 ? (
            <div className="empty-state compact">No hay próximos partidos.</div>
          ) : (
            matches.map((match) => (
              <div className="match-row-wrapper" key={match.id}>
                <button
                  className="match-row"
                  type="button"
                  onClick={() => onOpenMatch(match.id)}
                >
                  <span>
                    <strong>{match.title || "Chamuscón"}</strong>
                    <small>{formatMatchDate(match)}</small>
                    {match.allowed_tags?.length > 0 && (
                      <span className="tag-list compact">
                        {match.allowed_tags.map((tag) => (
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
