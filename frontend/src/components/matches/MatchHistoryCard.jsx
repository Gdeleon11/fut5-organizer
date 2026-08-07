import React from "react";
import { Button } from "../ui/Button.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Calendar, MapPin, Users, Trash2, ArrowRight } from "lucide-react";
import { formatMatchDate } from "../../utils.js";
import { formatTag } from "../../tags.js";

/**
 * F5Manager MatchHistoryCard Component
 */
export function MatchHistoryCard({
  match,
  confirmedCount,
  isAdmin,
  isDeleting,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
  onOpenMatch,
}) {
  return (
    <div className="f5-history-row">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Badge variant="neutral">Jugado</Badge>
          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <Users size={13} /> {confirmedCount} jugadores
          </span>
        </div>

        <h4 style={{ margin: "0.2rem 0 0 0", fontSize: "1.1rem", fontWeight: "700", color: "#ffffff" }}>
          {match.title || "Chamuscón"}
        </h4>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", fontSize: "0.82rem", color: "var(--text-muted)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <Calendar size={14} className="f5-text-primary" />
            <span>{formatMatchDate(match)}</span>
          </div>
          {match.venue && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <MapPin size={14} />
              <span>{match.venue}</span>
            </div>
          )}
        </div>

        {(match.allowed_tags || []).length > 0 && (
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
            {(match.allowed_tags || []).map((tag) => (
              <span className="tag-chip is-readonly" key={tag} style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                {formatTag(tag)}
              </span>
            ))}
          </div>
        )}
      </div>

      {isDeleting ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--danger)", fontWeight: "600" }}>
            ¿Eliminar este partido?
          </span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <Button variant="danger" size="sm" onClick={() => onConfirmDelete(match.id)}>
              Confirmar
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancelDelete}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "center" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenMatch(match.id)}
            icon={<ArrowRight size={14} />}
          >
            Ver resumen
          </Button>

          {isAdmin && (
            <IconButton
              icon={<Trash2 size={16} className="f5-text-danger" />}
              title={`Eliminar ${match.title || "Chamuscón"}`}
              onClick={() => onStartDelete(match.id)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default MatchHistoryCard;
