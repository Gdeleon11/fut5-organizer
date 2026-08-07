import React from "react";
import { Button } from "../ui/Button.jsx";
import { ClipboardList, Plus, X } from "lucide-react";

/**
 * F5Manager MatchesHeader Component
 *
 * @param {Object} props
 * @param {boolean} props.isAdmin
 * @param {boolean} props.showCreate
 * @param {() => void} props.onToggleCreate
 * @param {() => void} props.onOpenPizarra
 */
export function MatchesHeader({
  isAdmin,
  showCreate,
  onToggleCreate,
  onOpenPizarra,
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "1rem",
      marginBottom: "1.5rem"
    }}>
      <div>
        <h1 style={{
          fontSize: "1.75rem",
          fontWeight: "800",
          color: "#ffffff",
          margin: 0,
          letterSpacing: "-0.02em"
        }}>
          PARTIDOS
        </h1>
        <p style={{
          fontSize: "0.88rem",
          color: "var(--text-muted)",
          margin: "0.25rem 0 0 0"
        }}>
          Organiza tus próximas chamuscas y revisa el historial del grupo.
        </p>
      </div>

      {isAdmin && (
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {onOpenPizarra && (
            <Button
              variant="secondary"
              size="md"
              onClick={onOpenPizarra}
              icon={<ClipboardList size={16} />}
            >
              Pizarra Táctica
            </Button>
          )}
          <Button
            variant={showCreate ? "ghost" : "primary"}
            size="md"
            onClick={onToggleCreate}
            icon={showCreate ? <X size={16} /> : <Plus size={16} />}
          >
            {showCreate ? "Cancelar" : "Nuevo Partido"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default MatchesHeader;
