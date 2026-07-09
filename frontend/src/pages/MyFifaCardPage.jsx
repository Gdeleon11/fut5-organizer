import { useState, useMemo, useEffect } from "react";
import FifaCard from "../components/FifaCard.jsx";
import SkillDistribution from "../components/SkillDistribution.jsx";
import { POSITION_OPTIONS, SKILL_OPTIONS, ROLE_LABELS } from "../constants.js";
import { displayName } from "../utils.js";

const SPANISH_POSITION_OPTIONS = [
  { id: "Flexible", label: "Flexible" },
  { id: "Goalkeeper", label: "POR (Portero)" },
  { id: "Defender", label: "DFC (Defensa)" },
  { id: "Midfielder", label: "MC (Medio)" },
  { id: "Forward", label: "DEL (Delantero)" }
];

export default function MyFifaCardPage({
  profile,
  profiles,
  ratingMap,
  skills = [],
  matchStats = [],
  isAdmin,
  isSuperAdmin,
  activeGroupId,
  onSaveProfile,
  onAddSkill,
  onRemoveSkill,
  onUpdateRole, // Nombrar administradores
  onCreateGroup, // Crear grupo
  onDeleteAccount,
  onSignOut,
}) {
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [nickname, setNickname] = useState(profile?.nickname || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [position, setPosition] = useState(profile?.preferred_position || "Flexible");
  
  // Image upload
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Admin nomination panel states
  const [nomineeId, setNomineeId] = useState("");
  const [nomineeRole, setNomineeRole] = useState("admin");

  // Sync state with profile updates
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setNickname(profile.nickname || "");
      setPhone(profile.phone || "");
      setPosition(profile.preferred_position || "Flexible");
      setAvatarPreview(profile.avatar_url || "");
    }
  }, [profile]);

  // Calculate dynamic stats for current user
  const userStats = useMemo(() => {
    if (!profile?.id) return { matches: 0, goals: 0, assists: 0, mvp: 0 };
    const playerStatsList = (matchStats || []).filter(
      (s) => s && s.player_id === profile.id
    );
    return {
      matches: playerStatsList.length,
      goals: playerStatsList.reduce((sum, s) => sum + (s.goals || 0), 0),
      assists: playerStatsList.reduce((sum, s) => sum + (s.assists || 0), 0),
      mvp: playerStatsList.filter((s) => s.mvp).length
    };
  }, [matchStats, profile?.id]);

  // Get active skills for current player
  const playerSkillsSet = useMemo(() => {
    const active = new Set();
    skills.forEach((s) => {
      if (s.player_id === profile?.id) {
        active.add(s.skill);
      }
    });
    return active;
  }, [skills, profile?.id]);

  // Handle avatar upload selection
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Save profile attributes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) {
      setError("El nombre completo es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      await onSaveProfile(
        {
          full_name: fullName.trim(),
          nickname: nickname.trim() || null,
          phone: phone.trim() || profile?.phone || "555-5555",
          preferred_position: position
        },
        avatarFile
      );
      alert("Atributos guardados con éxito.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Toggle skills (Admin only)
  const handleSkillToggle = async (skillId) => {
    if (!isAdmin) return; // Player cannot toggle their own skills
    try {
      if (playerSkillsSet.has(skillId)) {
        // Remove skill
        const skillRow = skills.find(
          (s) => s.player_id === profile.id && s.skill === skillId
        );
        if (skillRow) {
          await onRemoveSkill(skillRow.id);
        }
      } else {
        // Add skill
        await onAddSkill(profile.id, skillId);
      }
    } catch (err) {
      alert("Error al actualizar habilidad: " + err.message);
    }
  };

  // Nominate member to role
  const handleNominateRole = async (e) => {
    e.preventDefault();
    if (!nomineeId) return;
    const nominee = profiles.find((p) => p.id === nomineeId);
    if (!nominee) return;
    if (window.confirm(`¿Seguro que deseas asignar el rol ${ROLE_LABELS[nomineeRole]} a ${displayName(nominee)}?`)) {
      try {
        await onUpdateRole(nomineeId, nomineeRole);
        alert("Rol actualizado correctamente.");
        setNomineeId("");
      } catch (err) {
        alert("Error: " + err.message);
      }
    }
  };

  return (
    <div className="page-grid my-fifa-card-page">
      {/* Left Column: FUT Card and dynamic stats */}
      <section className="panel" style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <p className="eyebrow">Tu Carta Oficial FUT F5</p>
        <div style={{ margin: "1.5rem 0", position: "relative" }}>
          <FifaCard
            profile={{ ...profile, avatar_url: avatarPreview, full_name: fullName, nickname }}
            ratingObj={ratingMap.get(profile?.id)}
            playerSkills={Array.from(playerSkillsSet)}
            matchStats={matchStats}
          />
          {/* Invisible file input triggered by label overlaying the card image area */}
          <label
            className="secondary-button"
            style={{
              marginTop: "1rem",
              width: "100%",
              display: "block",
              textAlign: "center",
              cursor: "pointer"
            }}
          >
            Subir Foto
            <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
          </label>
        </div>

        {/* Distribución de Habilidades — gráfica basada en atributos configurados */}
        <SkillDistribution
          profile={profile}
          ratingObj={ratingMap.get(profile?.id)}
          playerSkills={Array.from(playerSkillsSet)}
          matchStats={matchStats}
        />

        {/* Conteo rápido de historial (asistencias / MVP) */}
        <div
          className="mini-stat-row"
          style={{
            width: "100%",
            marginTop: "0.75rem",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.5rem",
          }}
        >
          <div className="skill-stat-card">
            <span className="skill-stat-label">Asistencias</span>
            <span className="skill-stat-value">{userStats.assists}</span>
          </div>
          <div className="skill-stat-card">
            <span className="skill-stat-label">MVP</span>
            <span className="skill-stat-value">{userStats.mvp}</span>
          </div>
        </div>
      </section>

      {/* Right Column: Attributes, Special Skills, and Admin controls */}
      <div style={{ flex: "2 1 400px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Attributes Form */}
        <section className="panel">
          <div className="section-heading">
            <h2>Atributos y Habilidades Especiales</h2>
          </div>
          {error && <p className="form-message" style={{ color: "var(--danger)" }}>{error}</p>}
          <form onSubmit={handleSaveProfile} className="form-grid">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>
                Nombre Completo
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </label>
              <label>
                Apodo (Nickname)
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
            </div>
            
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>
                Teléfono
                <input
                  type="tel"
                  placeholder="Tu número celular"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label>
                Posición de Preferencia
                <select value={position} onChange={(e) => setPosition(e.target.value)}>
                  {SPANISH_POSITION_OPTIONS.map((pos) => (
                    <option key={pos.id} value={pos.id}>{pos.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Special Skills grid — rediseñado */}
            <div className="skills-block">
              <div className="skills-block-head">
                <span className="skills-block-title">Habilidades Especiales F5</span>
                <span className="skills-block-hint">
                  {isAdmin ? "Toca para activar / desactivar" : "Asignadas por el Admin"}
                </span>
              </div>
              <div className="skills-grid-v2">
                {SKILL_OPTIONS.map((skill) => {
                  const isActive = playerSkillsSet.has(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => handleSkillToggle(skill.id)}
                      className={`skill-chip ${isActive ? "is-active" : ""} ${!isAdmin ? "is-readonly" : ""}`}
                      disabled={!isAdmin}
                      aria-pressed={isActive}
                    >
                      <span className="skill-chip-emoji" aria-hidden="true">{skill.emoji}</span>
                      <span className="skill-chip-text">
                        <strong>{skill.label}</strong>
                        <small>{skill.desc}</small>
                      </span>
                      {isActive && <span className="skill-chip-check" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar Habilidades & Datos"}
            </button>
          </form>
        </section>

        {/* Admin nominate control panel */}
        {isAdmin && (
          <section className="panel">
            <div className="section-heading">
              <h2>Panel de Control de Administrador</h2>
              <small>Nombra a otros miembros como administradores del grupo para delegar cobros y validar canchas.</small>
            </div>
            <form onSubmit={handleNominateRole} className="form-grid" style={{ gridTemplateColumns: "2fr 1.5fr 1fr", gap: "1rem", alignItems: "end" }}>
              <label style={{ margin: 0 }}>
                Miembro a Nombrar
                <select value={nomineeId} onChange={(e) => setNomineeId(e.target.value)} required>
                  <option value="">-- Seleccionar Miembro --</option>
                  {profiles
                    .filter((p) => p.id !== profile.id && p.membership_is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{displayName(p)}</option>
                    ))}
                </select>
              </label>
              <label style={{ margin: 0 }}>
                Rol a Asignar
                <select value={nomineeRole} onChange={(e) => setNomineeRole(e.target.value)}>
                  <option value="admin">Administrador</option>
                  <option value="super_admin">Super Administrador</option>
                  <option value="player">Jugador</option>
                </select>
              </label>
              <button type="submit" style={{ width: "100%", padding: "0.7rem 0.5rem" }}>Nombrar Admin</button>
            </form>
          </section>
        )}

        {/* Group Creation Call to Action */}
        <section
          className="panel"
          style={{
            borderTop: "4px solid var(--primary)",
            background: "var(--background-alt)"
          }}
        >
          <div className="section-heading">
            <div>
              <h3>¿Quieres crear tu propio grupo de fútbol?</h3>
              <small>Crea un nuevo grupo, conviértete en el administrador y gestiona tus propias canchas y partidos.</small>
            </div>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={onCreateGroup}
            style={{ width: "100%", marginTop: "1rem" }}
          >
            + Crear mi propio grupo ahora
          </button>
        </section>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: "1.5rem" }}>
          {onSignOut && (
            <button
              className="secondary-button"
              type="button"
              onClick={onSignOut}
              style={{ fontSize: "0.85rem" }}
            >
              Cerrar sesión
            </button>
          )}
          {onDeleteAccount && (
            <button
              className="ghost-button danger-button"
              type="button"
              onClick={() => {
                if (window.confirm("¿Seguro que deseas eliminar tu cuenta permanentemente? Esta acción es irreversible.")) {
                  onDeleteAccount();
                }
              }}
              style={{ fontSize: "0.85rem" }}
            >
              Eliminar mi cuenta
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
