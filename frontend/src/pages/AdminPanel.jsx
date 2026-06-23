import { useState } from "react";
import MatchForm from "../components/MatchForm.jsx";
import ExportCard from "../components/ExportCard.jsx";
import { formatMatchDate, formatMoney, matchInvitationText, statusLabel } from "../utils.js";

export default function AdminPanel({
  matches,
  venues,
  onCreateMatch,
  onDeleteMatch,
  onEditMatch,
  onGenerateTeams,
  teamsByMatch,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [createdMatch, setCreatedMatch] = useState(null);

  async function handleCreate(payload, photoFile) {
    const created = await onCreateMatch(payload, photoFile);
    if (created) {
      setCreatedMatch(created);
      setShowCreate(false);
    }
  }

  async function handleEdit(matchId, payload) {
    await onEditMatch(matchId, payload);
    setEditingId(null);
  }

  async function handleDelete(matchId) {
    await onDeleteMatch(matchId);
    setDeletingId(null);
  }

  return (
    <div className="page-grid">

      {/* ── Create match ── */}
      <section className="panel">
        <div className="section-heading">
          <h2>Partidos</h2>
          <button
            className={showCreate ? "secondary-button" : ""}
            type="button"
            onClick={() => { setShowCreate((v) => !v); setCreatedMatch(null); }}
          >
            {showCreate ? "Cancelar" : "+ Nuevo partido"}
          </button>
        </div>

        {showCreate && (
          <MatchForm
            venues={venues}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {createdMatch && !showCreate && (
          <ExportCard
            label="Link de invitación para WhatsApp"
            text={matchInvitationText(createdMatch, 0)}
          />
        )}
      </section>

      {/* ── Match list ── */}
      <section className="panel">
        <div className="section-heading">
          <h2>Todos los partidos</h2>
          <span className="count-pill">{matches.length}</span>
        </div>

        <div className="list">
          {matches.length === 0 ? (
            <div className="empty-state compact">
              No hay partidos. Creá el primero arriba.
            </div>
          ) : (
            matches.map((match) => (
              <article className="match-admin-card" key={match.id}>

                {/* Header */}
                <div className="match-admin-header">
                  <div>
                    <strong>{match.title || "Chamuscón"}</strong>
                    <small>
                      {formatMatchDate(match)}
                      {match.court_cost > 0
                        ? ` · cancha ${formatMoney(match.court_cost)}`
                        : " · gratis"}
                    </small>
                  </div>
                  <div className="match-admin-pills">
                    <span className="status-pill">{statusLabel(match.status)}</span>
                    <span className="count-pill">
                      {(teamsByMatch[match.id] || []).length} equipos
                    </span>
                  </div>
                </div>

                {/* Edit form (inline) */}
                {editingId === match.id ? (
                  <MatchForm
                    initial={match}
                    venues={venues}
                    onSave={(payload) => handleEdit(match.id, payload)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    {/* Actions */}
                    <div className="button-row">
                      <button type="button" onClick={() => onGenerateTeams(match, {})}>
                        Generar equipos
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => { setEditingId(match.id); setDeletingId(null); }}
                      >
                        Editar
                      </button>
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
                          onClick={() => { setDeletingId(match.id); setEditingId(null); }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    {deletingId === match.id && (
                      <p className="confirm-delete-msg">
                        ¿Eliminar "{match.title || "Chamuscón"}"? Se borran equipos,
                        asistencias y cobros asociados.
                      </p>
                    )}
                  </>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
