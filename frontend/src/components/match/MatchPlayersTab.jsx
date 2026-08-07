import React from "react";
import { Card } from "../ui/Card.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import Avatar from "../Avatar.jsx";
import { Users, Clock } from "lucide-react";
import { attendanceLabel, displayName } from "../../utils.js";

/**
 * F5Manager MatchPlayersTab Component ("Jugadores" tab content)
 */
export function MatchPlayersTab({
  confirmedPlayers = [],
  attendances = [],
  profileById,
  ratingMap,
  maxPlayers = 15,
}) {
  const waitlistAttendances = (attendances || []).filter((a) => a.status === "waitlist");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Confirmed Players Grid */}
      <Card variant="default">
        <SectionHeader
          title="Jugadores Confirmados"
          subtitle={`${confirmedPlayers.length} de ${maxPlayers} plazas ocupadas`}
          icon={<Users size={18} className="f5-text-success" />}
        />

        {confirmedPlayers.length === 0 ? (
          <div className="empty-state compact" style={{ padding: "1.5rem 0", textAlign: "center", color: "var(--text-muted)" }}>
            Aún no hay jugadores confirmados. ¡Sé el primero en unirte!
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: "0.75rem",
            marginTop: "0.5rem"
          }}>
            {confirmedPlayers.map((cp, idx) => {
              const prefPos = cp.profile?.preferred_position
                ? cp.profile.preferred_position.substring(0, 3).toUpperCase()
                : "JUG";
              const rating = ratingMap?.get(cp.id)?.rating || 70;

              return (
                <div key={cp.id} className="f5-player-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <Avatar profile={cp.is_guest ? null : cp.profile} size={32} />
                    <div>
                      <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "#ffffff", display: "block", lineHeight: "1.2" }}>
                        {cp.name} {cp.is_guest && <span style={{ fontSize: "0.7rem", color: "var(--primary)" }}>(invitado)</span>}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {prefPos} · OVR {rating}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "var(--primary)", fontWeight: "700" }}>
                    #{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Waitlist Section (if any) */}
      {waitlistAttendances.length > 0 && (
        <Card variant="default">
          <SectionHeader
            title="Lista de Espera"
            subtitle={`${waitlistAttendances.length} ${waitlistAttendances.length === 1 ? "jugador en espera" : "jugadores en espera"}`}
            icon={<Clock size={18} className="f5-text-warning" />}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {waitlistAttendances.map((a, idx) => {
              const player = profileById?.get(a.profile_id);
              const name = player ? displayName(player) : "Jugador";

              return (
                <div key={a.id} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.85rem",
                  background: "rgba(245, 158, 11, 0.05)",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                  borderRadius: "var(--r-md)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <Avatar profile={player} size={28} />
                    <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "#ffffff" }}>{name}</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--warning)", fontWeight: "700" }}>
                    Turno #{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export default MatchPlayersTab;
