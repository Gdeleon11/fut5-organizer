import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  CloudSun,
  Crown,
  Link2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import Avatar from "../Avatar.jsx";
import PlayerFace, { playerPhotoUrl } from "../PlayerFace.jsx";
import PlayerBadge from "../PlayerBadge.jsx";
import FifaCard from "../FifaCard.jsx";
import WeatherWidget from "../WeatherWidget.jsx";
import SelfStatsCard from "../SelfStatsCard.jsx";
import PostMatchSummaryCard from "../PostMatchSummaryCard.jsx";
import ExportCard from "../ExportCard.jsx";
import SocialShareCard from "../SocialShareCard.jsx";
import TeamShareCard from "../TeamShareCard.jsx";
import CopyReservationTextButton from "../CopyReservationTextButton.jsx";
import StarRatingControl from "../StarRatingControl.jsx";
import { attendanceLabel, displayName, matchInvitationText, teamAnnouncementText, teamNotificationText } from "../../utils.js";

/* ---------- Section heading (editorial hairline / command panel title) ---------- */
export function DetailHeading({ id, title, meta, icon: Icon, action }) {
  return (
    <div className="mdd-head">
      <h2 id={id}>
        {Icon && <Icon size={18} aria-hidden="true" />}
        {title}
      </h2>
      {meta && <small>{meta}</small>}
      {action && <span className="mdd-head-action">{action}</span>}
    </div>
  );
}

/* ---------- FIFA card modal (same behaviour as TeamCards) ---------- */
export function useFifaModal() {
  const [player, setPlayer] = useState(null);
  return { player, open: setPlayer, close: () => setPlayer(null) };
}

export function FifaModal({ player, onClose, ratingMap, skills, matchStats }) {
  useEffect(() => {
    if (!player) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, onClose]);
  if (!player) return null;
  return (
    <div className="fifa-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Carta de ${player.full_name || player.nickname || "jugador"}`}>
      <div className="fifa-modal-content" onClick={(e) => e.stopPropagation()}>
        <FifaCard
          profile={player.isGuest ? null : player}
          ratingObj={player.isGuest ? null : ratingMap?.get(player.id)}
          playerSkills={player.isGuest ? [] : (skills || []).filter((s) => s.player_id === player.id)}
          isGuest={player.isGuest}
          guestRating={player.isGuest ? player.guestRating || 3 : 3}
          matchStats={matchStats}
          showStats
        />
        <button className="fifa-modal-close-btn" type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export const asFifaPlayer = (p) =>
  p.isGuest ? { isGuest: true, full_name: p.name, guestRating: p.guestRating || 3 } : p.profile;

/* ---------- Roster ---------- */
export function RosterSection({ vm, variant, onOpenPlayer, onCopyGuestLink, guestLinkCopied }) {
  const empty = vm.roster.length === 0;
  return (
    <section className={`mdd-section mdd-roster is-${variant}`} aria-labelledby="mdd-roster-title" id="convocatoria">
      <DetailHeading
        id="mdd-roster-title"
        title="Convocatoria"
        icon={variant === "command" ? Users : null}
        meta={`${vm.confirmedCount}/${vm.capacity} confirmados${vm.free > 0 ? ` · ${vm.free} libres` : " · completo"}`}
        action={
          <button type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={onCopyGuestLink}>
            {guestLinkCopied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
            {guestLinkCopied ? "Enlace copiado" : "Enlace para invitados"}
          </button>
        }
      />
      {empty ? (
        <p className="mdd-empty">Aún no hay jugadores confirmados. ¡Sé el primero en unirte!</p>
      ) : variant === "command" ? (
        <ul className="mdd-cc-roster">
          {vm.roster.map((p) => (
            <li key={p.key}>
              <button type="button" className={`mdd-cc-player${p.isMe ? " is-me" : ""}`} onClick={() => onOpenPlayer(asFifaPlayer(p))} disabled={!p.isGuest && !p.profile}>
                <span className="mdd-cc-pos">{p.positionShort}</span>
                <span className={`mdd-cc-tok${playerPhotoUrl(p.profile) ? " has-photo" : ""}`}><PlayerFace profile={p.profile} initial={p.initial} size={32} /></span>
                <span className="mdd-cc-name">
                  {p.name}
                  <small>{p.isGuest ? "Invitado" : p.positionLabel}</small>
                </span>
                <span className="mdd-cc-meta">
                  {p.checkedIn && <span className="md-chip tone-ok mdd-mini">En cancha</span>}
                  {!p.isGuest && p.rating && <PlayerBadge rating={p.rating} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="mdd-ed-roster">
          {vm.roster.map((p) => (
            <li key={p.key}>
              <button type="button" className={`mdd-ed-row${p.isMe ? " is-me" : ""}`} onClick={() => onOpenPlayer(asFifaPlayer(p))} disabled={!p.isGuest && !p.profile}>
                <span className="mdd-ed-n">{String(p.order).padStart(2, "0")}</span>
                <span className="mdd-ed-name">
                  {p.name}
                  {p.isMe && <em>Tú</em>}
                </span>
                <span className="mdd-ed-pos">{p.isGuest ? "Invitado" : p.positionLabel}</span>
                {p.checkedIn ? <span className="mdd-ed-flag">En cancha</span> : <span className="mdd-ed-flag is-dim">Confirmado</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function WaitlistSection({ vm, variant }) {
  if (vm.waitlist.length === 0) return null;
  return (
    <section className={`mdd-section mdd-waitlist is-${variant}`} aria-labelledby="mdd-wait-title">
      <DetailHeading
        id="mdd-wait-title"
        title="Lista de espera"
        icon={variant === "command" ? Clock : null}
        meta={`${vm.waitlist.length} ${vm.waitlist.length === 1 ? "jugador" : "jugadores"} · entran por orden si se libera un cupo`}
      />
      <ol className="mdd-wait-list">
        {vm.waitlist.map((w) => (
          <li key={w.key} className={w.isMe ? "is-me" : ""}>
            <span className="mdd-wait-turn">#{w.turn}</span>
            <Avatar profile={w.profile} size="sm" />
            <span className="mdd-wait-name">{w.name}{w.isMe && <em>Tú</em>}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Teams ---------- */
export function TeamsPitch({ teams, onOpenPlayer }) {
  const [a, b] = teams;
  const side = (team, dir) => {
    if (!team) return null;
    const gk = team.members.filter((m) => m.position === "Goalkeeper");
    const def = team.members.filter((m) => m.position === "Defender");
    const fwd = team.members.filter((m) => m.position === "Forward");
    const mid = team.members.filter((m) => !["Goalkeeper", "Defender", "Forward"].includes(m.position));
    const lines = [gk, def, mid, fwd].filter((l) => l.length > 0);
    const ordered = dir === "right" ? [...lines].reverse() : lines;
    return (
      <div className={`mdd-pitch-half is-${dir}`} style={{ "--team": team.color }}>
        {ordered.map((line, i) => (
          <div className="mdd-pitch-line" key={i}>
            {line.map((m) => (
              <button
                type="button"
                key={m.key}
                className={`mdd-pitch-tok${m.isMe ? " is-me" : ""}${playerPhotoUrl(m.profile) ? " has-photo" : ""}`}
                onClick={() => onOpenPlayer(asFifaPlayer(m))}
                disabled={!m.isGuest && !m.profile}
                aria-label={`Ver ficha de ${m.name} · ${m.positionLabel}`}
                title={`${m.name} · ${m.positionLabel}`}
              >
                <PlayerFace profile={m.profile} initial={m.initial} size={40} />
                <small>{m.name}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  };
  return (
    <div className="mdd-pitch" role="img" aria-label={`Formación: ${teams.map((t) => `${t.name} ${t.members.length} jugadores`).join(", ")}`}>
      <div className="mdd-pitch-marks" aria-hidden="true">
        <span className="mdd-pitch-box l" />
        <span className="mdd-pitch-box r" />
      </div>
      {side(a, "left")}
      {side(b, "right")}
    </div>
  );
}

export function TeamsSection({ vm, variant, isAdmin, onOpenPlayer }) {
  const has = vm.teams.length > 0;
  return (
    <section className={`mdd-section mdd-teams is-${variant}`} aria-labelledby="mdd-teams-title" id="equipos">
      <DetailHeading
        id="mdd-teams-title"
        title="Equipos"
        icon={variant === "command" ? Shield : null}
        meta={has ? `${vm.teams.length} equipos` : "Pendientes"}
      />
      {!has ? (
        <p className="mdd-empty">Los equipos aparecerán cuando el organizador los genere.</p>
      ) : (
        <>
          {variant === "command" && vm.teams.length >= 2 && <TeamsPitch teams={vm.teams} onOpenPlayer={onOpenPlayer} />}
          <div className={`mdd-team-grid cols-${Math.min(vm.teams.length, 3)}`}>
            {vm.teams.map((t) => (
              <article key={t.key} className="mdd-team" style={{ "--team": t.color }}>
                <header>
                  <span className="mdd-team-dot" aria-hidden="true" />
                  <h3>{t.name}</h3>
                  <small>{t.members.length} jugadores{isAdmin && t.totalRating ? ` · ${t.totalRating} ★` : ""}</small>
                </header>
                <ul>
                  {t.members.map((m) => (
                    <li key={m.key}>
                      <button type="button" className={m.isMe ? "is-me" : ""} onClick={() => onOpenPlayer(asFifaPlayer(m))}>
                        <span className="mdd-team-pos">{m.positionShort}</span>
                        <span className="mdd-team-name">{m.name}</span>
                        {m.isGuest && <span className="mdd-team-guest">Invitado</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          {isAdmin && (
            <details className="mdd-share">
              <summary>
                Compartir equipos <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="mdd-share-grid">
                <ExportCard label="Equipos para WhatsApp" text={teamAnnouncementText(vm.match, vm.rawTeams)} />
                <ExportCard label="Notificar equipos a jugadores" text={teamNotificationText(vm.match, vm.rawTeams)} />
                <TeamShareCard match={vm.match} teams={vm.rawTeams} />
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- Venue + weather ---------- */
export function VenueSection({ vm, variant }) {
  const { venue, notes, match } = vm;
  return (
    <section className={`mdd-section mdd-venue is-${variant}`} aria-labelledby="mdd-venue-title" id="cancha">
      <DetailHeading id="mdd-venue-title" title="La cancha" icon={variant === "command" ? MapPin : null} meta={venue.name || "Por definir"} />
      <div className="mdd-venue-body">
        <div className="mdd-venue-info">
          {venue.address && (
            <p>
              <MapPin size={16} aria-hidden="true" /> {venue.address}
            </p>
          )}
          {venue.notes && <p className="mdd-dim">{venue.notes}</p>}
          {notes && (
            <blockquote>
              <strong>Notas del organizador</strong>
              {notes}
            </blockquote>
          )}
          {!venue.address && !venue.notes && !notes && <p className="mdd-dim">Sin detalles adicionales de la cancha.</p>}
        </div>
        {match.match_date && (
          <div className="mdd-weather">
            <span className="mdd-weather-label">
              <CloudSun size={16} aria-hidden="true" /> Pronóstico para el partido
            </span>
            <WeatherWidget venue={venue.name || "Guatemala"} date={match.match_date} time={match.start_time} lat={venue.lat} lng={venue.lng} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Post-match summary ---------- */
export function SummarySection({ vm, variant, profile, matchStats, currentMatchStats, didParticipate }) {
  if (!vm.isClosed) return null;
  return (
    <section className={`mdd-section mdd-summary is-${variant}`} aria-labelledby="mdd-summary-title" id="resumen">
      <DetailHeading id="mdd-summary-title" title="Resultado y estadísticas" icon={variant === "command" ? Trophy : null} meta={vm.hasStats ? "Registradas" : "Sin registrar"} />
      <div className="mdd-scoreline">
        <div><b>{vm.confirmedCount}</b><small>Jugaron</small></div>
        <div><b>{vm.totals.goals}</b><small>Goles</small></div>
        <div><b>{vm.totals.assists}</b><small>Asistencias</small></div>
        <div className="is-mvp"><b>{vm.totals.mvp || "—"}</b><small>MVP</small></div>
      </div>
      {vm.totals.scorers.length > 0 && (
        <ol className="mdd-scorers" aria-label="Goleadores">
          {vm.totals.scorers.map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <b>{s.goals}</b>
            </li>
          ))}
        </ol>
      )}
      <div className="mdd-summary-tools">
        {didParticipate && (
          <SelfStatsCard match={vm.match} profile={profile} matchStats={matchStats} activeGroupId={vm.match.group_id} />
        )}
        <PostMatchSummaryCard match={vm.match} stats={currentMatchStats} confirmedCount={vm.confirmedCount} />
      </div>
    </section>
  );
}

/* ---------- Stats & result modal (admin) ---------- */
export function StatsModal({ open, statsForm, updateStatField, onSave, saving, onClose, title }) {
  const firstRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    firstRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const goals = statsForm.reduce((n, r) => n + Number(r.goals || 0), 0);
  const assists = statsForm.reduce((n, r) => n + Number(r.assists || 0), 0);
  const mvp = statsForm.find((r) => r.mvp)?.name;
  const step = (row, field, delta) => {
    const id = row.is_guest ? row.guest_player_id : row.player_id;
    updateStatField(id, row.is_guest, field, Math.max(0, Number(row[field] || 0) + delta));
  };
  return (
    <div className="md-modal-overlay" onClick={onClose}>
      <div className="md-modal mdd-stats-modal" role="dialog" aria-modal="true" aria-labelledby="mdd-stats-title" onClick={(e) => e.stopPropagation()}>
        <header className="md-modal-head">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2 id="mdd-stats-title">Estadísticas del partido</h2>
            <small>{title}</small>
          </div>
          <button type="button" className="md-icon-btn" aria-label="Cerrar" onClick={onClose} ref={firstRef}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="mdd-stats-board" aria-live="polite">
          <div><b>{goals}</b><small>Goles</small></div>
          <div><b>{assists}</b><small>Asistencias</small></div>
          <div className="is-mvp"><b>{mvp || "—"}</b><small>MVP</small></div>
        </div>
        <div className="md-modal-body">
          {statsForm.length === 0 ? (
            <p className="mdd-empty">No hay jugadores confirmados para registrar.</p>
          ) : (
            <ul className="mdd-stats-rows">
              {statsForm.map((row) => {
                const id = row.is_guest ? row.guest_player_id : row.player_id;
                return (
                  <li key={`${row.is_guest ? "g" : "p"}-${id}`}>
                    <span className="mdd-stats-name">
                      {row.name}
                      {row.is_guest && <small>Invitado</small>}
                    </span>
                    {[
                      ["goals", "Goles"],
                      ["assists", "Asist."],
                    ].map(([field, label]) => (
                      <span className="mdd-stepper" key={field} role="group" aria-label={`${label} de ${row.name}`}>
                        <small>{label}</small>
                        <button type="button" aria-label={`Restar ${label}`} onClick={() => step(row, field, -1)} disabled={!row[field]}>
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <b>{row[field] || 0}</b>
                        <button type="button" aria-label={`Sumar ${label}`} onClick={() => step(row, field, 1)}>
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    <label className={`mdd-toggle${row.mvp ? " is-on" : ""}`}>
                      <input type="checkbox" checked={Boolean(row.mvp)} onChange={(e) => updateStatField(id, row.is_guest, "mvp", e.target.checked)} />
                      <Crown size={14} aria-hidden="true" /> MVP
                    </label>
                    <label className={`mdd-toggle${row.clean_sheet ? " is-on" : ""}`}>
                      <input type="checkbox" checked={Boolean(row.clean_sheet)} onChange={(e) => updateStatField(id, row.is_guest, "clean_sheet", e.target.checked)} />
                      <Shield size={14} aria-hidden="true" /> Valla
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="md-modal-foot">
          <button type="button" className="md-btn md-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="md-btn md-btn-accent" onClick={onSave} disabled={saving}>
            <Save size={16} aria-hidden="true" /> {saving ? "Guardando…" : "Guardar estadísticas"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ---------- Admin tools (same handlers as the former MatchAdminPanel) ---------- */
function AdminGroup({ title, icon: Icon, children, defaultOpen = false, tone }) {
  return (
    <details className={`mdd-admin-group${tone ? ` tone-${tone}` : ""}`} open={defaultOpen}>
      <summary>
        {Icon && <Icon size={17} aria-hidden="true" />}
        <span>{title}</span>
        <ChevronDown size={16} aria-hidden="true" className="mdd-chev" />
      </summary>
      <div className="mdd-admin-body">{children}</div>
    </details>
  );
}

export function AdminTools({
  vm,
  variant,
  attendances,
  profiles,
  profileById,
  guests,
  onGenerateTeams,
  onAIDistribute,
  aiLoading,
  aiError,
  teamInstructions,
  setTeamInstructions,
  onOpenStats,
  onCheckIn,
  onMarkNoShow,
  onReconfirm,
  onAddGuest,
  onDeleteGuest,
  onUpdateGuestRating,
  onDeleteMatch,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestRating, setGuestRating] = useState(2);
  const match = vm.match;

  function addGuest(e) {
    e.preventDefault();
    if (!guestName.trim()) return;
    onAddGuest(guestName.trim(), guestRating);
    setGuestName("");
    setGuestRating(2);
  }

  return (
    <section className={`mdd-admin is-${variant}`} aria-labelledby="mdd-admin-title">
      <DetailHeading id="mdd-admin-title" title="Administración del partido" icon={Zap} meta="Solo administradores" />
      <div className="mdd-admin-quick">
        <button type="button" className="md-btn md-btn-accent" onClick={() => onGenerateTeams?.({})}>
          <Zap size={16} aria-hidden="true" /> Generar equipos
        </button>
        <button type="button" className="md-btn md-btn-ghost" onClick={onAIDistribute} disabled={aiLoading}>
          <Sparkles size={16} aria-hidden="true" /> {aiLoading ? "Generando con IA…" : "Generar con IA"}
        </button>
        {onOpenStats && (
          <button type="button" className="md-btn md-btn-ghost" onClick={onOpenStats}>
            <Trophy size={16} aria-hidden="true" /> Ir al postpartido
          </button>
        )}
      </div>
      <label className="mdd-field">
        <span>Instrucciones para la IA (opcional)</span>
        <input
          type="text"
          placeholder="Ej. separar a Juan y Pedro, equipos de 6"
          value={teamInstructions}
          onChange={(e) => setTeamInstructions(e.target.value)}
        />
      </label>
      {aiError && <p className="mdd-alert tone-warn">{aiError}</p>}

      <AdminGroup title={`Control de asistencia (${(attendances || []).length})`} icon={Users}>
        {(attendances || []).length === 0 ? (
          <p className="mdd-empty">Aún no hay confirmaciones.</p>
        ) : (
          <ul className="mdd-admin-list">
            {attendances.map((a) => (
              <li key={a.id}>
                <span>
                  <b>{displayName(profileById?.get(a.profile_id))}</b>
                  <small>{attendanceLabel(a.status, a.checked_in)}</small>
                </span>
                <span className="mdd-admin-actions">
                  <button type="button" className="md-btn md-btn-ghost md-btn-sm" disabled={a.checked_in} onClick={() => onCheckIn(a)}>
                    Check-in
                  </button>
                  <button type="button" className="md-btn md-btn-ghost md-btn-sm" disabled={a.status === "no_show"} onClick={() => onMarkNoShow(a)}>
                    No llegó
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {vm.canceled.length > 0 && (
          <>
            <h4 className="mdd-sub">Cancelaron ({vm.canceled.length})</h4>
            <ul className="mdd-admin-list">
              {vm.canceled.map((a) => (
                <li key={a.id}>
                  <span><b>{displayName(profileById?.get(a.profile_id))}</b></span>
                  <button type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={() => onReconfirm?.(a.id)}>
                    <RefreshCw size={13} aria-hidden="true" /> Reconfirmar
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </AdminGroup>

      <AdminGroup title={`Invitados (${(guests || []).length})`} icon={UserPlus}>
        <form className="mdd-guest-form" onSubmit={addGuest}>
          <label className="mdd-field">
            <span>Nombre del invitado</span>
            <input type="text" placeholder="Ej. Carlos (amigo de Juan)" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </label>
          <div className="mdd-field">
            <span>Nivel estimado</span>
            <StarRatingControl currentRating={guestRating} onSelect={setGuestRating} />
          </div>
          <button type="submit" className="md-btn md-btn-accent md-btn-sm" disabled={!guestName.trim()}>
            <Plus size={14} aria-hidden="true" /> Agregar invitado
          </button>
        </form>
        {(guests || []).length > 0 && (
          <ul className="mdd-admin-list">
            {guests.map((g) => (
              <li key={g.id}>
                <span><b>{g.name}</b></span>
                <span className="mdd-admin-actions">
                  <span className="mdd-rating-pick" role="group" aria-label={`Nivel de ${g.name}`}>
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" className={g.rating === n ? "is-on" : ""} aria-pressed={g.rating === n} onClick={() => onUpdateGuestRating(g.id, n)}>
                        {n}★
                      </button>
                    ))}
                  </span>
                  <button type="button" className="md-icon-btn" aria-label={`Quitar a ${g.name}`} onClick={() => onDeleteGuest(g.id)}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminGroup>

      <AdminGroup title="Invitación y reserva" icon={Link2}>
        {match.requires_reservation && <CopyReservationTextButton match={match} attendances={attendances} profiles={profiles} />}
        <div className="mdd-share-grid">
          <ExportCard label="Invitación para WhatsApp" text={matchInvitationText(match, vm.confirmedCount)} />
          <SocialShareCard match={match} confirmedCount={vm.confirmedCount} waitlistCount={vm.waitlist.length} />
        </div>
      </AdminGroup>

      <AdminGroup title="Zona de peligro" icon={AlertTriangle} tone="bad">
        <p className="mdd-dim">Eliminar este partido borra de forma permanente los equipos, asistencias y multas asociadas.</p>
        {confirmingDelete ? (
          <div className="mdd-admin-actions">
            <button type="button" className="md-btn md-btn-danger md-btn-sm" onClick={() => onDeleteMatch?.(match.id)}>
              Sí, eliminar partido
            </button>
            <button type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="md-btn md-btn-danger md-btn-sm" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={14} aria-hidden="true" /> Eliminar partido
          </button>
        )}
      </AdminGroup>
    </section>
  );
}
