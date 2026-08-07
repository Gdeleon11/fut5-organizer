import React from "react";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import { Save, Trophy, ShieldAlert } from "lucide-react";

/**
 * F5Manager MatchStatsEditor Component
 */
export function MatchStatsEditor({
  statsForm = [],
  updateStatField,
  handleSaveStats,
  savingStats,
  onCancel,
}) {
  return (
    <Card variant="default">
      <SectionHeader
        title="Cargar / Editar Estadísticas"
        subtitle="Registra goles, asistencias, MVP del partido y valla invicta."
        icon={<Trophy size={18} className="f5-text-warning" />}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.25rem" }}>
        {statsForm.map((row) => {
          const pId = row.is_guest ? row.guest_player_id : row.player_id;
          return (
            <div
              key={`${row.is_guest ? "g" : "p"}-${pId}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.6rem 0.85rem",
                background: "var(--surface-2)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border-subtle)",
                gap: "0.5rem",
                flexWrap: "wrap"
              }}
            >
              <strong style={{ minWidth: "120px", flex: "1", fontSize: "0.88rem", color: "#ffffff" }}>
                {row.name} {row.is_guest && <span style={{ fontSize: "0.7rem", color: "var(--primary)" }}>(invitado)</span>}
              </strong>

              <div style={{ display: "flex", gap: "0.85rem", alignItems: "center", flexWrap: "wrap" }}>
                {/* Goles */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span title="Goles" style={{ fontSize: "0.9rem" }}>⚽</span>
                  <input
                    type="number"
                    min="0"
                    value={row.goals}
                    onChange={(e) =>
                      updateStatField(pId, row.is_guest, "goals", parseInt(e.target.value) || 0)
                    }
                    style={{
                      width: "48px",
                      padding: "0.3rem",
                      textAlign: "center",
                      fontSize: "0.85rem",
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      color: "#ffffff"
                    }}
                  />
                </div>

                {/* Asistencias */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span title="Asistencias" style={{ fontSize: "0.9rem" }}>👟</span>
                  <input
                    type="number"
                    min="0"
                    value={row.assists}
                    onChange={(e) =>
                      updateStatField(pId, row.is_guest, "assists", parseInt(e.target.value) || 0)
                    }
                    style={{
                      width: "48px",
                      padding: "0.3rem",
                      textAlign: "center",
                      fontSize: "0.85rem",
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      color: "#ffffff"
                    }}
                  />
                </div>

                {/* MVP */}
                <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.8rem", color: row.mvp ? "var(--warning)" : "var(--text-secondary)", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={row.mvp}
                    onChange={(e) =>
                      updateStatField(pId, row.is_guest, "mvp", e.target.checked)
                    }
                  />
                  👑 MVP
                </label>

                {/* Valla Invicta */}
                <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.8rem", color: row.clean_sheet ? "var(--primary)" : "var(--text-secondary)", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={row.clean_sheet}
                    onChange={(e) =>
                      updateStatField(pId, row.is_guest, "clean_sheet", e.target.checked)
                    }
                  />
                  🧤 Valla
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="md" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="success"
          size="md"
          loading={savingStats}
          onClick={handleSaveStats}
          icon={<Save size={16} />}
        >
          Guardar Estadísticas
        </Button>
      </div>
    </Card>
  );
}

export default MatchStatsEditor;
