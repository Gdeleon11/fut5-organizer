import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * F5Manager DevRoleBanner Component
 */
export function DevRoleBanner({
  myRole,
  setDevRoleOverride,
  setProfile,
  profiles = [],
}) {
  return (
    <div style={{
      background: "linear-gradient(90deg, #7f1d1d, #991b1b)",
      color: "#ffffff",
      padding: "0.4rem 1rem",
      fontSize: "0.82rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.15)",
      zIndex: 95
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "600" }}>
        <ShieldAlert size={16} />
        <span>MODO DESARROLLO / DEMO:</span>
        <span style={{
          background: "#ef4444",
          color: "#ffffff",
          padding: "2px 8px",
          borderRadius: "12px",
          fontSize: "0.72rem",
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: "0.05em"
        }}>
          {myRole === "super_admin" ? "👑 SUPER ADMIN" : myRole === "admin" ? "📋 ADMIN" : "🏃 JUGADOR"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Simular rol:</span>
        <select
          aria-label="Simular Rol"
          value={myRole}
          onChange={(e) => {
            const chosenRole = e.target.value;
            setDevRoleOverride(chosenRole);
            const roleProfileMap = {
              super_admin: "e62c1146-24be-47a3-83f1-778848d7d001",
              admin: "e62c1146-24be-47a3-83f1-778848d7d002",
              player: "e62c1146-24be-47a3-83f1-778848d7d003"
            };
            const profileId = roleProfileMap[chosenRole];
            const matched = profiles.find((p) => p.id === profileId);
            if (matched) setProfile(matched);
          }}
          style={{
            background: "rgba(0,0,0,0.4)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "6px",
            padding: "2px 8px",
            fontSize: "0.78rem",
            fontWeight: "600",
            outline: "none",
            cursor: "pointer"
          }}
        >
          <option value="super_admin">Guille de León (Super Admin)</option>
          <option value="admin">Ale (Admin)</option>
          <option value="player">Javi B (Jugador)</option>
        </select>
      </div>
    </div>
  );
}

export default DevRoleBanner;
