import React from "react";
import { Card } from "../ui/Card.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Button } from "../ui/Button.jsx";
import { ProgressBar } from "../ui/ProgressBar.jsx";
import { Calendar, Clock, MapPin, Users, ArrowRight } from "lucide-react";
import { formatMatchDate } from "../../utils.js";

/**
 * F5Manager UpcomingMatchCard Component
 */
export function UpcomingMatchCard({
  match,
  confirmedCount,
  onOpenMatch,
}) {
  const maxPlayers = match.max_players || 15;
  const isFull = confirmedCount >= maxPlayers;

  return (
    <Card variant="default" interactive style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <Badge variant="info">PRÓXIMO</Badge>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: "600" }}>
            {confirmedCount}/{maxPlayers}
          </span>
        </div>

        <h3 style={{
          fontSize: "1.15rem",
          fontWeight: "700",
          color: "#ffffff",
          margin: "0 0 0.5rem 0",
          lineHeight: "1.3"
        }}>
          {match.title || match.venue || "Chamuscón"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Calendar size={14} className="f5-text-primary" />
            <span>{formatMatchDate(match)}</span>
          </div>
          {match.start_time && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Clock size={14} className="f5-text-info" />
              <span>{match.start_time}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <MapPin size={14} className="f5-text-muted" />
            <span>{match.venue || "Lugar pendiente"}</span>
          </div>
        </div>

        <ProgressBar
          value={confirmedCount}
          max={maxPlayers}
          showCount={false}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={() => onOpenMatch(match.id)}
          icon={<ArrowRight size={16} />}
        >
          Ver Partido
        </Button>
      </div>
    </Card>
  );
}

export default UpcomingMatchCard;
