import AttendanceAction from "../components/AttendanceAction.jsx";
import CourtPhoto from "../components/CourtPhoto.jsx";
import ExportCard from "../components/ExportCard.jsx";
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
    </div>
  );
}
