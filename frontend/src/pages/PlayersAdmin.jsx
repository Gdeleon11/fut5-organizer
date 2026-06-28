import { useState } from "react";
import FifaCard from "../components/FifaCard.jsx";
import Avatar from "../components/Avatar.jsx";
import PlayerBadge from "../components/PlayerBadge.jsx";
import VoteButtons from "../components/VoteButtons.jsx";
import StarRatingControl, {
  PositionRatingControl,
  PositionRatingDisplay,
} from "../components/StarRatingControl.jsx";
import Stars from "../components/Stars.jsx";
import { FILTER_LABELS, POSITION_OPTIONS, SKILL_OPTIONS } from "../constants.js";
import { formatTag, parseTags } from "../tags.js";
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
  onCreateGroupTag,
  onUpdateMember,
  onUpdateProfile,
  profiles,
  ratingMap,
  voteScoreMap,
  userVoteMap,
  onVote,
  currentProfileId,
  skills,
  onAddSkill,
  onRemoveSkill,
}) {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedSkillToAdd, setSelectedSkillToAdd] = useState("");
  const [addingSkillMap, setAddingSkillMap] = useState({});
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
  const [tagDrafts, setTagDrafts] = useState({});

  function playerTags(player) {
    return player?.group_tags || [];
  }

  function tagDraft(player) {
    return tagDrafts[player.id] ?? playerTags(player).join(", ");
  }

  return (
    <div className="players-admin-grid">
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
                {playerTags(player).length > 0 && (
                  <div className="tag-list">
                    {playerTags(player).map((tag) => (
                      <span className="tag-chip is-readonly" key={tag}>{formatTag(tag)}</span>
                    ))}
                  </div>
                )}
                <div className="player-card-badge">
                  <PlayerBadge rating={ratingMap.get(player.id)} />
                  {player.id !== currentProfileId && (
                    <VoteButtons
                      average={voteScoreMap.get(player.id)?.average || 0}
                      totalVotes={voteScoreMap.get(player.id)?.count || 0}
                      userVote={userVoteMap.get(player.id) || 0}
                      onVote={(vote) => onVote(player.id, vote)}
                    />
                  )}
                </div>
                {isSuperAdmin && (() => {
                  const playerSkills = skills?.filter((s) => s.player_id === player.id) || [];
                  const SKILL_MAP = Object.fromEntries(SKILL_OPTIONS.map((o) => [o.id, o]));
                  const hasMaxSkills = playerSkills.length >= 3;
                  return (
                    <div className="player-skills">
                      {playerSkills.length > 0 ? (
                        <div className="player-skills-list">
                          {playerSkills.map((s) => {
                            const skill = SKILL_MAP[s.skill];
                            if (!skill) return null;
                            return (
                              <span
                                key={s.id}
                                className="skill-badge"
                                title={`${skill.label} - ${skill.desc}`}
                                onClick={() => { if (confirm(`¿Quitar ${skill.label}?`)) onRemoveSkill(s.id); }}
                              >
                                {skill.emoji}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                      {hasMaxSkills ? (
                        <small className="skill-limit-msg">Máximo 3 skills</small>
                      ) : (
                        <select
                          className="skill-select"
                          value={addingSkillMap[player.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              onAddSkill(player.id, val);
                              setAddingSkillMap((prev) => ({ ...prev, [player.id]: "" }));
                            }
                          }}
                        >
                          <option value="">+ Asignar skill</option>
                          {SKILL_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.emoji} {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })()}
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
            <div className="player-detail-split">
              {/* Left Column: FIFA Card */}
              <div className="fifa-card-sticky-wrap">
                <FifaCard
                  profile={selected}
                  ratingObj={ratingMap.get(selected.id)}
                  playerSkills={skills?.filter((s) => s.player_id === selected.id) || []}
                  isGuest={false}
                />
              </div>

              {/* Right Column: Player metadata & edit controls */}
              <div className="player-detail-controls">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Detalle del jugador</p>
                    <h2>{displayName(selected)}</h2>
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

                <div className="profile-summary" style={{ gridTemplateColumns: "1fr 1fr" }}>
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
                  <span style={{ gridColumn: "span 2" }}>
                    <strong>{playerTags(selected).length ? playerTags(selected).join(", ") : "Ninguno"}</strong>
                    <small>Tags de subgrupo</small>
                  </span>
                </div>

            <div className="quick-actions">
              {isSuperAdmin && (
                <div className="detail-section">
                  <div className="section-heading">
                    <div>
                      <h2>Tags de subgrupo</h2>
                      <small>Ej. martes, veteranos, competitivos. Separá con comas.</small>
                    </div>
                  </div>
                  <div className="tag-editor">
                    <input
                      value={tagDraft(selected)}
                      placeholder="martes, veteranos"
                      onChange={(e) => setTagDrafts((drafts) => ({
                        ...drafts,
                        [selected.id]: e.target.value,
                      }))}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const nextTags = parseTags(tagDraft(selected));
                        if (onCreateGroupTag) {
                          await Promise.all(nextTags.map((tag) => onCreateGroupTag(tag)));
                        }
                        await onUpdateProfile(selected.id, { group_tags: nextTags });
                        setTagDrafts((drafts) => ({ ...drafts, [selected.id]: nextTags.join(", ") }));
                      }}
                    >
                      Guardar tags
                    </button>
                  </div>
                  {playerTags(selected).length > 0 && (
                    <div className="tag-list">
                      {playerTags(selected).map((tag) => (
                        <span className="tag-chip is-readonly" key={tag}>{formatTag(tag)}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isSuperAdmin && (
                <div className="detail-section">
                  <div className="section-heading">
                    <div>
                      <h2>Habilidades Especiales</h2>
                      <small>Máximo 3 habilidades por jugador.</small>
                    </div>
                  </div>
                  {(() => {
                    const playerSkills = skills?.filter((s) => s.player_id === selected.id) || [];
                    const SKILL_MAP = Object.fromEntries(SKILL_OPTIONS.map((o) => [o.id, o]));
                    const hasMaxSkills = playerSkills.length >= 3;
                    return (
                      <div className="player-skills" style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                        {playerSkills.map((s) => {
                          const skill = SKILL_MAP[s.skill];
                          if (!skill) return null;
                          return (
                            <span
                              key={s.id}
                              className="skill-badge"
                              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.35rem 0.65rem" }}
                              title={`${skill.label} - ${skill.desc} (Click para quitar)`}
                              onClick={() => { if (confirm(`¿Quitar ${skill.label}?`)) onRemoveSkill(s.id); }}
                            >
                              {skill.emoji} {skill.label}
                            </span>
                          );
                        })}
                        {!hasMaxSkills && (
                          <select
                            className="skill-select"
                            value={selectedSkillToAdd}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                onAddSkill(selected.id, val);
                                setSelectedSkillToAdd("");
                              }
                            }}
                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.85rem" }}
                          >
                            <option value="">+ Agregar habilidad</option>
                            {SKILL_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.emoji} {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
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
            </div> {/* Closes player-detail-controls */}
          </div> {/* Closes player-detail-split */}
        </>
        )}
      </section>
    </div>
  );
}
