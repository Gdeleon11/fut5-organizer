import React from "react";
import { Button } from "../ui/Button.jsx";
import { Calendar, X } from "lucide-react";

/**
 * F5Manager MatchesHistoryFilter Component
 */
export function MatchesHistoryFilter({
  historyFrom,
  historyTo,
  onChangeFrom,
  onChangeTo,
  onClear,
}) {
  const hasFilter = Boolean(historyFrom || historyTo);

  return (
    <div className="f5-history-filter-bar">
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: "600", fontSize: "0.85rem", color: "#ffffff", marginRight: "0.5rem" }}>
        <Calendar size={16} className="f5-text-primary" />
        <span>Filtrar fechas:</span>
      </div>

      <div className="f5-history-filter-input">
        <span>Desde:</span>
        <input
          type="date"
          value={historyFrom}
          max={historyTo || undefined}
          onChange={(e) => onChangeFrom(e.target.value)}
        />
      </div>

      <div className="f5-history-filter-input">
        <span>Hasta:</span>
        <input
          type="date"
          value={historyTo}
          min={historyFrom || undefined}
          onChange={(e) => onChangeTo(e.target.value)}
        />
      </div>

      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          icon={<X size={14} />}
        >
          Limpiar
        </Button>
      )}
    </div>
  );
}

export default MatchesHistoryFilter;
