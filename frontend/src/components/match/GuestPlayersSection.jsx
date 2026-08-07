import React, { useState } from "react";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import StarRatingControl from "../StarRatingControl.jsx";
import { UserPlus, Link2, Trash2, Check } from "lucide-react";
import { api } from "../../api.js";
import { copyToClipboard } from "../../utils.js";

/**
 * F5Manager GuestPlayersSection Component
 */
export function GuestPlayersSection({
  match,
  guests = [],
  onAdd,
  onDelete,
  onUpdateRating,
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(2);
  const [copied, setCopied] = useState(false);

  function handleAdd() {
    if (!name.trim()) return;
    onAdd(name.trim(), rating);
    setName("");
    setRating(2);
    setShowForm(false);
  }

  async function copyGuestLink() {
    const link = api.generateGuestLink(match?.id);
    try {
      await copyToClipboard(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying guest link:", err);
    }
  }

  return (
    <Card variant="default">
      <SectionHeader
        title="Jugadores Invitados"
        subtitle="Agrega invitados temporales solo para este partido."
        icon={<UserPlus size={18} className="f5-text-success" />}
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyGuestLink}
              icon={copied ? <Check size={14} /> : <Link2 size={14} />}
            >
              {copied ? "Copiado ✓" : "Link Invitado"}
            </Button>
            <Button
              variant={showForm ? "ghost" : "secondary"}
              size="sm"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancelar" : "+ Agregar"}
            </Button>
          </div>
        }
      />

      {showForm && (
        <div style={{
          background: "var(--surface-2)",
          padding: "1rem",
          borderRadius: "var(--r-md)",
          marginBottom: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem"
        }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Nombre del invitado
            </label>
            <input
              type="text"
              placeholder="Ej. Carlos (amigo de Juan)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "var(--r-sm)",
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                color: "#ffffff"
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Nivel estimado (1-4 estrellas)
            </label>
            <StarRatingControl currentRating={rating} onSelect={setRating} />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!name.trim()}
          >
            Guardar Invitado
          </Button>
        </div>
      )}

      {(guests || []).length === 0 && !showForm ? (
        <div className="empty-state compact" style={{ padding: "1rem 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          No hay jugadores invitados registrados.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {(guests || []).map((guest) => (
            <div
              key={guest.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.6rem 0.85rem",
                background: "var(--surface-2)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border-subtle)",
                gap: "0.5rem"
              }}
            >
              <div>
                <strong style={{ fontSize: "0.88rem", color: "#ffffff", display: "block" }}>{guest.name}</strong>
                <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem" }}>
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onUpdateRating(guest.id, n)}
                      style={{
                        padding: "0.1rem 0.4rem",
                        fontSize: "0.7rem",
                        borderRadius: "4px",
                        border: "1px solid var(--border)",
                        background: guest.rating === n ? "var(--primary)" : "transparent",
                        color: guest.rating === n ? "#000" : "var(--text-muted)",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      {n}★
                    </button>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(guest.id)}
                icon={<Trash2 size={14} className="f5-text-danger" />}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default GuestPlayersSection;
