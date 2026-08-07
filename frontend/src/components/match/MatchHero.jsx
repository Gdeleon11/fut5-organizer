import React from "react";
import { Check, X, Clock, Calendar, MapPin, Users, Cloud, ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { Card } from "../ui/Card.jsx";
import { Badge } from "../ui/Badge.jsx";
import { ProgressBar } from "../ui/ProgressBar.jsx";
import { formatMatchDate, isFullMatch } from "../../utils.js";

/**
 * F5Manager MatchHero Component (V2 Hero Card)
 */
export function MatchHero({
  match,
  confirmedCount,
  myAttendance,
  onConfirm,
  onCancel,
  onJoinWaitlist,
  onBack,
  attendances = [],
  selectedVenue,
}) {
  const maxPlayers = match?.max_players || 15;
  const isFull = isFullMatch(match, attendances);
  const remaining = Math.max(0, maxPlayers - confirmedCount);
  const isClosed = match?.status === "closed" || match?.status === "finished";

  // Attendance status logic
  const status = myAttendance?.status;
  const isConfirmed = status === "confirmed" || status === "checked_in";
  const isWaitlist = status === "waitlist";
  const isCanceled = status === "canceled";

  return (
    <Card variant="hero" className="f5-match-hero">
      {/* Top Bar: Back & Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft size={16} />}>
            Volver al Cartelero
          </Button>
        ) : <div />}

        <Badge variant={isClosed ? "neutral" : isFull ? "warning" : "success"}>
          {isClosed ? "Finalizado" : isFull ? "Partido Lleno" : "Convocatoria Abierta"}
        </Badge>
      </div>

      {/* Main Title & Pitch */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{
          fontSize: "1.65rem",
          fontWeight: "700",
          color: "#ffffff",
          margin: "0 0 0.4rem 0",
          letterSpacing: "-0.02em",
          lineHeight: "1.2"
        }}>
          {match.title || selectedVenue?.name || match.venue || "Plaza 1 - Sintética"}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          <MapPin size={16} style={{ color: "var(--primary)" }} />
          <span>{selectedVenue?.address || selectedVenue?.name || match.venue || "Guatemala"}</span>
        </div>
      </div>

      {/* Key Info Grid */}
      <div className="f5-match-info-grid">
        {/* Date */}
        <div className="f5-match-info-item">
          <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: "rgba(57, 229, 90, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <Calendar size={18} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700", letterSpacing: "0.08em" }}>FECHA</span>
            <span style={{ fontSize: "0.88rem", color: "#ffffff", fontWeight: "600" }}>{formatMatchDate(match)}</span>
          </div>
        </div>

        {/* Kickoff Time */}
        <div className="f5-match-info-item">
          <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--info)" }}>
            <Clock size={18} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700", letterSpacing: "0.08em" }}>HORARIO</span>
            <span style={{ fontSize: "0.88rem", color: "#ffffff", fontWeight: "600" }}>{match.start_time || "19:00 PM"}</span>
          </div>
        </div>

        {/* Quorum */}
        <div className="f5-match-info-item">
          <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--warning)" }}>
            <Users size={18} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700", letterSpacing: "0.08em" }}>QUÓRUM</span>
            <span style={{ fontSize: "0.88rem", color: "#ffffff", fontWeight: "600" }}>{confirmedCount} / {maxPlayers}</span>
          </div>
        </div>
      </div>

      {/* Quorum Progress Bar */}
      <div style={{ marginBottom: "1.5rem" }}>
        <ProgressBar
          value={confirmedCount}
          max={maxPlayers}
          label="Cupos confirmados"
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem", fontSize: "0.78rem" }}>
          <span style={{ color: remaining > 0 ? "var(--primary)" : "var(--warning)", fontWeight: "600" }}>
            {remaining > 0 ? `⚡ ${remaining} ${remaining === 1 ? "lugar disponible" : "lugares disponibles"}` : "⚠️ Convocatoria completa"}
          </span>
          {match.fine_amount ? (
            <span style={{ color: "var(--text-muted)" }}>Fine: Q{match.fine_amount} por cancelación tardía</span>
          ) : null}
        </div>
      </div>

      {/* Divider */}
      <div className="f5-inline-divider" />

      {/* Main Action Callout */}
      {!isClosed && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div>
            <span style={{ fontWeight: "600", color: "#ffffff", display: "block", fontSize: "0.95rem" }}>
              {isConfirmed ? "✓ Estás confirmado para este partido" : isWaitlist ? "⏳ En lista de espera" : "¿Vas a jugar?"}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              {isConfirmed ? "Si cambias de opinión, cancela a tiempo." : "Confirma tu asistencia lo antes posible."}
            </span>
          </div>

          {/* Action Button */}
          <div>
            {isConfirmed ? (
              <Button variant="danger" size="md" onClick={onCancel} icon={<X size={18} />}>
                Cancelar Asistencia
              </Button>
            ) : isWaitlist ? (
              <Button variant="secondary" size="md" onClick={onCancel} icon={<Clock size={18} />}>
                Salir de Lista de Espera
              </Button>
            ) : isCanceled ? (
              <Button variant="success" size="md" onClick={onConfirm} icon={<Check size={18} />}>
                Volver a Confirmar
              </Button>
            ) : isFull ? (
              <Button variant="secondary" size="md" onClick={onJoinWaitlist} icon={<Clock size={18} />}>
                Unirse a Lista de Espera
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={onConfirm} icon={<Check size={20} />}>
                CONFIRMAR ASISTENCIA
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sticky CTA Bar */}
      {!isClosed && (
        <div className="f5-sticky-cta">
          {isConfirmed ? (
            <Button variant="danger" fullWidth size="lg" onClick={onCancel} icon={<X size={20} />}>
              Cancelar Asistencia
            </Button>
          ) : isWaitlist ? (
            <Button variant="secondary" fullWidth size="lg" onClick={onCancel} icon={<Clock size={20} />}>
              Salir de Lista de Espera
            </Button>
          ) : isCanceled ? (
            <Button variant="success" fullWidth size="lg" onClick={onConfirm} icon={<Check size={20} />}>
              Volver a Confirmar
            </Button>
          ) : isFull ? (
            <Button variant="secondary" fullWidth size="lg" onClick={onJoinWaitlist} icon={<Clock size={20} />}>
              Unirse a Lista de Espera
            </Button>
          ) : (
            <Button variant="primary" fullWidth size="lg" onClick={onConfirm} icon={<Check size={20} />}>
              CONFIRMAR ASISTENCIA ⚽
            </Button>
          )}
        </div>
      )}

    </Card>
  );
}

export default MatchHero;
