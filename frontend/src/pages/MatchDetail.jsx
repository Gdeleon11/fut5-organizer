import AttendanceAction from "../components/AttendanceAction.jsx";
import CourtPhoto from "../components/CourtPhoto.jsx";
import ExportCard from "../components/ExportCard.jsx";
import StarRatingControl from "../components/StarRatingControl.jsx";
import TeamCards from "../components/TeamCards.jsx";
import { useState } from "react";
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

function GuestPlayersSection({ match, guests, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(2);

  function handleAdd() {
    if (!name.trim()) return;
    onAdd(name.trim(), rating);
    setName("");
    setRating(2);
    setShowForm(false);
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Jugadores invitados</h2>
          <small>Temporal solo para este partido</small>
        </div>
        <div className="button-row">
          <span className="count-pill">{guests.length}</span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancelar" : "+ Invitar"}
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

      {guests.length === 0 && !showForm ? (
        <div className="empty-state compact">No hay jugadores invitados.</div>
      ) : (
        <div className="player-list">
          {guests.map((guest) => (
            <div className="player-row" key={guest.id}>
              <div>
                <strong>{guest.name}</strong>
                <small>{guest.rating} estrella{guest.rating !== 1 ? "s" : ""}</small>
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
  attendances,
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
  guests,
  profile,
  profileById,
  teams,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [teamInstructions, setTeamInstructions] = useState("");

  const canPenaltyTeam = confirmedCount >= 13 && confirmedCount <= 14;
  const isPlayerConfirmed = myAttendance && ["confirmed", "checked_in"].includes(myAttendance.status);

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
        {(isAdmin || isPlayerConfirmed) && <CourtPhoto match={match} />}
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
              <button type="button" onClick={() => onGenerateTeams({ instructions: teamInstructions })}>
                Generar equipos
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
            <TeamCards teams={teams} isAdmin={isAdmin} />
            {isAdmin && (
              <>
                <ExportCard
                  label="Equipos para WhatsApp"
                  text={teamAnnouncementText(match, teams)}
                />
                <ExportCard
                  label="Notificar equipos a jugadores"
                  text={teamNotificationText(match, teams)}
                />
              </>
            )}
          </>
        )}
      </section>

      {isAdmin && (
        <section className="panel">
          <div className="section-heading">
            <h2>Asistencia</h2>
            <span className="count-pill">{attendances.length}</span>
          </div>
          <div className="player-list">
            {attendances.length === 0 ? (
              <div className="empty-state compact">Aún no hay confirmaciones.</div>
            ) : (
              attendances.map((attendance) => {
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
        />
      )}
    </div>
  );
}
