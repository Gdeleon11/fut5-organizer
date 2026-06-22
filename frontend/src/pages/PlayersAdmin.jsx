import { useState } from "react";
import Avatar from "../components/Avatar.jsx";
import PlayerBadge from "../components/PlayerBadge.jsx";
import SectionBanner from "../components/SectionBanner.jsx";
import StarRatingControl, {
  PositionRatingControl,
  PositionRatingDisplay,
} from "../components/StarRatingControl.jsx";
import Stars from "../components/Stars.jsx";
import { FILTER_LABELS, POSITION_OPTIONS } from "../constants.js";
import {
  appShareUrl,
  attendanceLabel,
  classNames,
  displayName,
  fineLabel,
  fineReasonLabel,
  formatMatchDate,
  formatMoney,
  groupInvitationText,
  positionLabel,
} from "../utils.js";

export default function PlayersAdmin({
  activeGroupId,
  attendances,
  fines,
  isSuperAdmin,
  matches,
  onAssignRating,
  onUpdateMember,
  onUpdateProfile,
  profiles,
  ratingMap,
}) {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const selected =
    profiles.find((item) => item.id === selectedId) || profiles[0];

  const filteredProfiles = profiles.filter((profile) => {
    if (filter === "active") return profile.membership_is_active;
    if (filter === "inactive") return !profile.membership_is_active;
    if (filter === "unrated") return !ratingMap.has(profile.id);
    if (filter === "unpaid") {
      return fines.some(
        (fine) => fine.profile_id === profile.id && fine.status === "open",
      );
    }
    return true;
  });

  const selectedAttendances = selected
    ? attendances.filter((a) => a.profile_id === selected.id)
    : [];
  const selectedFines = selected
    ? fines.filter((f) => f.profile_id === selected.id)
    : [];
  const matchById = new Map(matches.map((match) => [match.id, match]));

  return (
    <div className="players-admin-grid">
      <SectionBanner section="jugadores" />
      <section className="panel">
        <div className="section-heading">
          <h2>Jugadores registrados</h2>
          <div className="button-row">
            <span className="count-pill">{filteredProfiles.length}</span>
            {isSuperAdmin && (
              <button
                className="secondary-button"
                type="button"
                onClick={async () => {
                  const url = appShareUrl(null, activeGroupId);
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    prompt("Copiá este link:", url);
                  }
                }}
              >
                {copied ? "Copiado ✓" : "Invitar jugador"}
              </button>
            )}
          </div>
        </div>
        <div className="player-filter-grid">
          {["all", "active", "inactive", "unrated", "unpaid"].map((item) => (
            <button
              className={filter === item ? "" : "secondary-button"}
              key={item}
              type="button"
              onClick={() => setFilter(item)}
            >
              {FILTER_LABELS[item]}
            </button>
          ))}
        </div>
        <div className="player-admin-list">
          {filteredProfiles.length === 0 ? (
            <div className="empty-state compact">
              No hay jugadores con este filtro.
            </div>
          ) : (
            filteredProfiles.map((player) => (
              <article
                className={classNames(
                  "player-admin-card",
                  selected?.id === player.id && "is-selected",
                )}
                key={player.id}
              >
                <div className="player-card-head">
                  <div className="player-title">
                    <Avatar profile={player} size="sm" />
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setSelectedId(player.id)}
                    >
                      {displayName(player)}
                    </button>
                  </div>
                  <span
                    className={classNames(
                      "status-pill",
                      player.membership_is_active && "is-paid",
                    )}
                  >
                    {player.membership_is_active ? "activo" : "inactivo"}
                  </span>
                </div>
                <small>
                  {positionLabel(player.preferred_position)} ·{" "}
                  {ratingMap.has(player.id) ? (
                    <PositionRatingDisplay ratings={ratingMap.get(player.id)} />
                  ) : (
                    "Sin estrellas"
                  )}
                </small>
                <div className="player-card-badge">
                  <PlayerBadge rating={ratingMap.get(player.id)} />
                </div>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setSelectedId(player.id)}
                  >
                    Detalles
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateMember(player.id, {
                        is_active: !player.membership_is_active,
                      })
                    }
                  >
                    {player.membership_is_active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel player-detail-panel">
        {!selected ? (
          <div className="empty-state compact">
            Los jugadores aparecerán aquí después de registrarse.
          </div>
        ) : (
          <>
            <div className="section-heading">
              <div className="identity-block">
                <Avatar profile={selected} size="lg" />
                <div>
                  <p className="eyebrow">Detalle del jugador</p>
                  <h2>{displayName(selected)}</h2>
                </div>
              </div>
              <span
                className={classNames(
                  "status-pill",
                  selected.membership_is_active && "is-paid",
                )}
              >
                {selected.membership_is_active ? "activo" : "inactivo"}
              </span>
            </div>

            <div className="profile-summary">
              <span>
                <strong>{selected.full_name}</strong>
                <small>Nombre completo</small>
              </span>
              <span>
                <strong>{selected.phone || "Sin teléfono"}</strong>
                <small>Teléfono</small>
              </span>
              <span>
                <strong>
                  {ratingMap.has(selected.id) ? (
                    <PositionRatingDisplay ratings={ratingMap.get(selected.id)} />
                  ) : (
                    "Sin estrellas"
                  )}
                </strong>
                <small>Estrellas</small>
              </span>
              <span>
                <strong>
                  <PlayerBadge rating={ratingMap.get(selected.id)} />
                </strong>
                <small>Nivel</small>
              </span>
            </div>

            <div className="quick-actions">
              {isSuperAdmin && (
                <div className="detail-section">
                  <div className="section-heading">
                    <div>
                      <h2>Asignar estrellas</h2>
                      <small>Solo Super Admin puede modificar ratings.</small>
                    </div>
                    <span className="count-pill">
                      {ratingMap.has(selected.id) ? (
                        <PositionRatingDisplay ratings={ratingMap.get(selected.id)} />
                      ) : (
                        "sin estrellas"
                      )}
                    </span>
                  </div>
                  <PositionRatingControl
                    ratings={ratingMap.get(selected.id) || {
                      attack_rating: 2,
                      defense_rating: 2,
                      midfield_rating: 2,
                      goalkeeper_rating: 2,
                    }}
                    onSelect={(key, level) =>
                      onAssignRating(selected.id, key, level)
                    }
                  />
                </div>
              )}
              {!isSuperAdmin && (
                <div className="detail-section">
                  <div className="section-heading">
                    <div><h2>Estrellas</h2></div>
                    <span className="count-pill">
                      {ratingMap.has(selected.id) ? (
                        <PositionRatingDisplay ratings={ratingMap.get(selected.id)} />
                      ) : (
                        "sin estrellas"
                      )}
                    </span>
                  </div>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>
                    Solo el Super Admin puede modificar los ratings.
                  </p>
                </div>
              )}
              <div className="position-actions">
                {POSITION_OPTIONS.map((position) => (
                  <button
                    className={
                      selected.preferred_position === position
                        ? ""
                        : "secondary-button"
                    }
                    key={position}
                    type="button"
                    onClick={() =>
                      onUpdateProfile(selected.id, { preferred_position: position })
                    }
                  >
                    {positionLabel(position)}
                  </button>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <div className="section-heading">
                <h2>Historial de asistencia</h2>
                <span className="count-pill">{selectedAttendances.length}</span>
              </div>
              {selectedAttendances.length === 0 ? (
                <div className="empty-state compact">Aún no hay asistencia.</div>
              ) : (
                <div className="list">
                  {selectedAttendances.map((attendance) => {
                    const match = matchById.get(attendance.match_id);
                    return (
                      <div className="history-row" key={attendance.id}>
                        <span>
                          <strong>
                            {match
                              ? formatMatchDate(match)
                              : "Partido desconocido"}
                          </strong>
                          <small>
                            {attendanceLabel(
                              attendance.status,
                              attendance.checked_in,
                            )}
                          </small>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="detail-section">
              <div className="section-heading">
                <h2>Resumen de multas</h2>
                <span className="count-pill">{selectedFines.length}</span>
              </div>
              {selectedFines.length === 0 ? (
                <div className="empty-state compact">No hay multas.</div>
              ) : (
                <div className="list">
                  {selectedFines.map((fine) => (
                    <div className="fine-row" key={fine.id}>
                      <span>
                        <strong>{fineReasonLabel(fine.reason)}</strong>
                        <small>{fineLabel(fine.status)}</small>
                      </span>
                      <span className="fine-amount">{formatMoney(fine.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
