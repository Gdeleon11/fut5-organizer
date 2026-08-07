import React, { useState } from "react";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import GuestPlayersSection from "./GuestPlayersSection.jsx";
import CopyReservationTextButton from "../CopyReservationTextButton.jsx";
import ExportCard from "../ExportCard.jsx";
import SocialShareCard from "../SocialShareCard.jsx";
import { Settings, Sparkles, Trophy, Users, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, XCircle } from "lucide-react";
import { attendanceLabel, displayName, matchInvitationText } from "../../utils.js";

/**
 * F5Manager MatchAdminPanel Component (Progressive disclosure admin tools)
 */
export function MatchAdminPanel({
  match,
  isAdmin,
  attendances = [],
  guests = [],
  profileById,
  profiles = [],
  confirmedCount,
  onGenerateTeams,
  handleAIDistribute,
  aiLoading,
  aiError,
  teamInstructions,
  setTeamInstructions,
  onCheckIn,
  onMarkNoShow,
  onReconfirm,
  onAddGuest,
  onDeleteGuest,
  onUpdateGuestRating,
  onDeleteMatch,
  setIsEditingStats,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canceledAttendances = (attendances || []).filter((a) => a.status === "canceled");

  if (!isAdmin) return null;

  return (
    <Card variant="hero" className="f5-admin-panel" style={{ borderLeft: "4px solid var(--primary)" }}>
      {/* Toggle Header */}
      <div
        onClick={() => setIsOpen((v) => !v)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Settings size={20} className="text-emerald-400" />
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "#ffffff" }}>
              Panel de Administración
            </h3>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {isOpen ? "Haz clic para contraer opciones de admin" : "Equipos, IA, asistencias, stats e invitaciones"}
            </span>
          </div>
        </div>

        <Button variant="secondary" size="sm" icon={isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}>
          {isOpen ? "Cerrar Panel" : "⚙ Administrar"}
        </Button>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>

          {/* 1. Equipos e Inteligencia Artificial */}
          <div>
            <SectionHeader
              title="Generación de Equipos"
              subtitle="Crea equipos balanceados de 5 vs 5 automáticamente o con asistencia de IA."
              icon={<Sparkles size={18} className="text-blue-400" />}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <input
                  type="text"
                  placeholder="Instrucciones para la IA (ej. 'Separa a Juan y Pedro', 'Equipos de 6')"
                  value={teamInstructions}
                  onChange={(e) => setTeamInstructions(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-1)",
                    border: "1px solid var(--border)",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    marginBottom: "0.5rem"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <Button
                  variant="primary"
                  size="md"
                  loading={aiLoading}
                  onClick={handleAIDistribute}
                  icon={<Sparkles size={16} />}
                >
                  🤖 Generar con IA
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsEditingStats((v) => !v)}
                  icon={<Trophy size={16} />}
                >
                  📝 Cargar / Editar Stats
                </Button>
              </div>

              {aiError && (
                <div style={{ color: "var(--warning)", fontSize: "0.8rem", background: "rgba(245, 158, 11, 0.1)", padding: "0.5rem", borderRadius: "6px", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                  {aiError}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

          {/* 2. Control de Asistencia y Check-in */}
          <div>
            <SectionHeader
              title="Control de Asistencia"
              subtitle="Registra llegada de jugadores en cancha o marca no-show."
              icon={<Users size={18} className="text-emerald-400" />}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
              {(attendances || []).length === 0 ? (
                <div className="empty-state compact" style={{ fontSize: "0.82rem" }}>Aún no hay confirmaciones.</div>
              ) : (
                attendances.map((attendance) => {
                  const player = profileById?.get(attendance.profile_id);
                  return (
                    <div
                      key={attendance.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.75rem",
                        background: "var(--surface-1)",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border-subtle)",
                        gap: "0.5rem"
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "0.85rem", color: "#ffffff", display: "block" }}>
                          {displayName(player)}
                        </strong>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {attendanceLabel(attendance.status, attendance.checked_in)}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={attendance.checked_in}
                          onClick={() => onCheckIn(attendance)}
                        >
                          Check-in
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={attendance.status === "no_show"}
                          onClick={() => onMarkNoShow(attendance)}
                        >
                          No llegó
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Jugadores Cancelados */}
          {canceledAttendances.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 0.5rem 0" }}>
                Jugadores Cancelados ({canceledAttendances.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {canceledAttendances.map((a) => {
                  const p = profileById?.get(a.profile_id);
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.75rem", background: "rgba(239, 68, 68, 0.05)", borderRadius: "var(--r-sm)" }}>
                      <span style={{ fontSize: "0.82rem", color: "#ffffff" }}>{displayName(p)}</span>
                      <Button variant="success" size="sm" onClick={() => onReconfirm?.(a.id)} icon={<RefreshCw size={12} />}>
                        Reconfirmar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

          {/* 4. Jugadores Invitados */}
          <GuestPlayersSection
            match={match}
            guests={guests}
            onAdd={onAddGuest}
            onDelete={onDeleteGuest}
            onUpdateRating={onUpdateGuestRating}
          />

          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

          {/* 5. Reserva & Invitación WhatsApp */}
          <div>
            <SectionHeader
              title="Invitación y Reserva"
              subtitle="Difunde el partido en tu grupo de WhatsApp."
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {match.requires_reservation && (
                <CopyReservationTextButton
                  match={match}
                  attendances={attendances}
                  profiles={profiles}
                />
              )}
              <div className="export-cards-grid" style={{ display: "grid", gap: "0.75rem" }}>
                <ExportCard
                  label="Invitación para WhatsApp"
                  text={matchInvitationText(match, confirmedCount)}
                />
                <SocialShareCard
                  match={match}
                  confirmedCount={confirmedCount}
                  waitlistCount={(attendances || []).filter((a) => a.status === "waitlist").length}
                />
              </div>
            </div>
          </div>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

          {/* 6. Danger Zone */}
          <div style={{
            background: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "var(--r-md)",
            padding: "1rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", color: "var(--danger)" }}>
              <AlertTriangle size={18} />
              <strong style={{ fontSize: "0.9rem" }}>Zona de Peligro</strong>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 0.85rem 0" }}>
              Eliminar este partido borrará de forma permanente los equipos, asistencias y multas asociadas.
            </p>

            {confirmingDelete ? (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <Button variant="danger" size="sm" onClick={() => onDeleteMatch?.(match?.id)}>
                  Sí, Eliminar Partido
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)} icon={<XCircle size={16} />}>
                Eliminar Partido
              </Button>
            )}
          </div>

        </div>
      )}
    </Card>
  );
}

export default MatchAdminPanel;
