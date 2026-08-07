import React from "react";
import { Card } from "../ui/Card.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Button } from "../ui/Button.jsx";
import { ProgressBar } from "../ui/ProgressBar.jsx";
import { Calendar, Clock, MapPin, Users, ArrowRight } from "lucide-react";
import { formatMatchDate } from "../../utils.js";

/**
 * F5Manager NextMatchHeroCard Component (Protagonist Next Match Card)
 */
export function NextMatchHeroCard({
  match,
  confirmedCount,
  onOpenMatch,
}) {
  if (!match) {
    return (
      <Card variant="default">
        <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-muted)" }}>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>⚽ Todavía no hay partidos programados próximamente.</p>
        </div>
      </Card>
    );
  }

  const maxPlayers = match.max_players || 15;
  const isFull = confirmedCount >= maxPlayers;
  const remaining = Math.max(0, maxPlayers - confirmedCount);

  return (
    <Card variant="hero" className="f5-next-match-hero">
      {/* Badge header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.15rem" }}>
        <Badge variant="primary" icon={<Calendar size={13} />}>
          PRÓXIMO PARTIDO MÁS CERCANO
        </Badge>
        <Badge variant={isFull ? "warning" : "success"}>
          {isFull ? "Partido Lleno" : "Convocatoria Abierta"}
        </Badge>
      </div>

      {/* Main Title & Venue */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 style={{
          fontSize: "1.45rem",
          fontWeight: "700",
          color: "#ffffff",
          margin: "0 0 0.35rem 0",
          letterSpacing: "-0.01em"
        }}>
          {match.title || match.venue || "Chamuscón"}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          <MapPin size={16} className="f5-text-primary" />
          <span>{match.venue || "Lugar reservado"}</span>
        </div>
      </div>

      {/* Date & Time Row */}
      <div className="f5-match-info-grid" style={{ marginBottom: "1.25rem" }}>
        <div className="f5-match-info-item">
          <Calendar size={18} className="f5-text-primary" />
          <div>
            <span style={{ display: "block", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700", letterSpacing: "0.08em" }}>FECHA</span>
            <span style={{ fontSize: "0.88rem", color: "#ffffff", fontWeight: "600" }}>{formatMatchDate(match)}</span>
          </div>
        </div>

        <div className="f5-match-info-item">
          <Clock size={18} className="f5-text-info" />
          <div>
            <span style={{ display: "block", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700", letterSpacing: "0.08em" }}>HORARIO</span>
            <span style={{ fontSize: "0.88rem", color: "#ffffff", fontWeight: "600" }}>{match.start_time || "19:00 PM"}</span>
          </div>
        </div>

        <div className="f5-match-info-item">
          <Users size={18} className="f5-text-warning" />
          <div>
            <span style={{ display: "block", fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700", letterSpacing: "0.08em" }}>QUÓRUM</span>
            <span style={{ fontSize: "0.88rem", color: "#ffffff", fontWeight: "600" }}>{confirmedCount} / {maxPlayers}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: "1.25rem" }}>
        <ProgressBar
          value={confirmedCount}
          max={maxPlayers}
          label="Jugadores confirmados"
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem", fontSize: "0.78rem" }}>
          <span style={{ color: remaining > 0 ? "var(--primary)" : "var(--warning)", fontWeight: "600" }}>
            {remaining > 0 ? `⚡ ${remaining} ${remaining === 1 ? "lugar disponible" : "lugares disponibles"}` : "⚠️ Convocatoria completa"}
          </span>
        </div>
      </div>

      <div className="f5-inline-divider" />

      {/* Footer CTA */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          {isFull ? "El cupo está lleno. ¡Revisa o súmate a lista de espera!" : "Convocatoria abierta para el equipo."}
        </span>
        <Button
          variant="primary"
          size="lg"
          onClick={() => onOpenMatch(match.id)}
          icon={<ArrowRight size={18} />}
        >
          Ver Partido
        </Button>
      </div>
    </Card>
  );
}

export default NextMatchHeroCard;
