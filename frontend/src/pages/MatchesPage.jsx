import AttendanceAction from "../components/AttendanceAction.jsx";
import CourtPhoto from "../components/CourtPhoto.jsx";
import ExportCard from "../components/ExportCard.jsx";
import MatchForm from "../components/MatchForm.jsx";
import { useState } from "react";
import {
  formatMatchDate,
  isConfirmedAttendance,
  matchInvitationText,
} from "../utils.js";

export default function MatchesPage({
  isAdmin,
  matchAttendances,
  matches,
  myAttendance,
  nextMatch,
  onConfirm,
  onCancel,
  onOpenMatch,
  onCreateMatch,
  onDeleteMatch,
  profile,
  fineAmount,
  venues,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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
              {matchAttendances(nextMatch.id).filter(isConfirmedAttendance).length}{" "}
              confirmados
            </span>
          )}
        </div>

        {nextMatch ? (
          <>
            <CourtPhoto match={nextMatch} />
            <p className="muted">{nextMatch.venue || "Cancha pendiente"}</p>
            <AttendanceAction
              attendance={myAttendance(nextMatch.id)}
              fineAmount={fineAmount}
              match={nextMatch}
              onConfirm={() => onConfirm(nextMatch)}
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
                matchAttendances(nextMatch.id).filter(isConfirmedAttendance).length,
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
                  </span>
                  <span className="count-pill">
                    {
                      matchAttendances(match.id).filter(isConfirmedAttendance)
                        .length
                    }
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
