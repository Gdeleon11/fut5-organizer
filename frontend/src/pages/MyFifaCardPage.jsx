import { useState, useMemo, useEffect } from "react";
import FifaCard from "../components/FifaCard.jsx";
import SkillDistribution from "../components/SkillDistribution.jsx";
import { POSITION_OPTIONS, SKILL_OPTIONS, ROLE_LABELS } from "../constants.js";
import { displayName } from "../utils.js";
import { Palette, ChevronRight, Camera, LogOut, Trash2, Users, UserCog } from "lucide-react";
import { computePlayerStats, playerTimeline } from "../players/playerStats.js";
import { EvolutionStrip, PlayerIdentity, SkillChips, StatTiles } from "../components/profile/ProfileBlocks.jsx";
import { attendanceLabel, formatMatchDate } from "../utils.js";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { DESIGNS, PALETTES } from "../appearance/appearance.js";

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
  onOpenAppearance,
  matches = [],
  attendances = [],
  voteScoreMap = null,
}) {
  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";
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

  const stats = computePlayerStats(profile, { matchStats, attendances, voteScoreMap });
  const timeline = playerTimeline(profile?.id, { matchStats, matches });
  const matchById = new Map((matches || []).map((m) => [m.id, m]));
  const myHistory = (attendances || []).filter((a) => a.profile_id === profile?.id)
    .sort((a, b) => String(matchById.get(b.match_id)?.match_date || "").localeCompare(String(matchById.get(a.match_id)?.match_date || "")))
    .slice(0, 10);
  const previewProfile = { ...profile, avatar_url: avatarPreview, full_name: fullName, nickname };
  const isCommand = variant === "command";

  const cardBlock = (
    <div className="mf-card">
      <FifaCard profile={previewProfile} ratingObj={ratingMap.get(profile?.id)} playerSkills={Array.from(playerSkillsSet)} matchStats={matchStats} />
      <label className="md-btn md-btn-ghost mf-photo">
        <Camera size={16} aria-hidden="true" /> {avatarFile ? "Foto lista para guardar" : "Cambiar foto"}
        <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
      </label>
    </div>
  );

  const sections = (
    <>
      {!isCommand && (
        <section className="pv-section" aria-labelledby="mf-stats-title">
          <div className="mdd-head"><h2 id="mf-stats-title">Estadísticas verificadas</h2><small>Registradas en partidos del grupo</small></div>
          <StatTiles stats={stats} variant={variant} />
        </section>
      )}
      <section className="pv-section" aria-labelledby="mf-attr-title">
        <div className="mdd-head"><h2 id="mf-attr-title">Atributos</h2><small>Según estrellas, capacidades y estadísticas</small></div>
        <SkillDistribution profile={profile} ratingObj={ratingMap.get(profile?.id)} playerSkills={Array.from(playerSkillsSet)} matchStats={matchStats} />
      </section>
      <section className="pv-section" aria-labelledby="mf-skills-title">
        <div className="mdd-head"><h2 id="mf-skills-title">Habilidades especiales</h2><small>{isAdmin ? "Toca para activar o desactivar" : "Asignadas por la administración"}</small></div>
        {isAdmin ? (
          <div className="skills-grid-v2 mf-skill-grid">
            {SKILL_OPTIONS.map((skill) => {
              const on = playerSkillsSet.has(skill.id);
              return (
                <button key={skill.id} type="button" onClick={() => handleSkillToggle(skill.id)} className={`skill-chip ${on ? "is-active" : ""}`} aria-pressed={on}>
                  <span className="skill-chip-emoji" aria-hidden="true">{skill.emoji}</span>
                  <span className="skill-chip-text"><strong>{skill.label}</strong><small>{skill.desc}</small></span>
                  {on && <span className="skill-chip-check" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <SkillChips skillIds={Array.from(playerSkillsSet)} />
        )}
      </section>
      <section className="pv-section" aria-labelledby="mf-evo-title">
        <div className="mdd-head"><h2 id="mf-evo-title">Evolución</h2><small>Goles y asistencias por partido</small></div>
        <EvolutionStrip timeline={timeline} variant={variant} />
      </section>
      <section className="pv-section" aria-labelledby="mf-hist-title">
        <div className="mdd-head"><h2 id="mf-hist-title">Mi historial</h2><small>{myHistory.length} recientes</small></div>
        {myHistory.length === 0 ? <p className="pf-empty">Aún no tienes asistencias registradas en este grupo.</p> : (
          <ul className="pv-history">
            {myHistory.map((a) => {
              const m = matchById.get(a.match_id);
              return <li key={a.id}><span>{m ? formatMatchDate(m) : "Partido"}</span><span className={`pv-att is-${a.status}`}>{attendanceLabel(a.status, a.checked_in)}</span></li>;
            })}
          </ul>
        )}
      </section>
    </>
  );

  const editForm = (
    <section className="pv-section mf-edit" aria-labelledby="mf-edit-title">
      <div className="mdd-head"><h2 id="mf-edit-title">Editar perfil</h2><small>Tu teléfono solo lo ve la administración</small></div>
      {error && <p className="form-message" role="alert">{error}</p>}
      <form onSubmit={handleSaveProfile} className="form-grid md-form">
        <fieldset className="md-form-group">
          <legend>Identidad</legend>
          <label className="md-form-wide">Nombre completo<input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
          <label className="md-form-wide">Apodo<input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} /></label>
          <label className="md-form-wide">Teléfono<input type="tel" placeholder="Tu número celular" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label className="md-form-wide">Posición preferida
            <select value={position} onChange={(e) => setPosition(e.target.value)}>
              {SPANISH_POSITION_OPTIONS.map((pos) => <option key={pos.id} value={pos.id}>{pos.label}</option>)}
            </select>
          </label>
        </fieldset>
        <div className="md-form-actions">
          <button type="submit" className="md-btn md-btn-accent" disabled={saving}>{saving ? "Guardando…" : "Guardar perfil"}</button>
        </div>
      </form>
    </section>
  );

  const adminBlock = isAdmin && (
    <section className="pv-section" aria-labelledby="mf-admin-title">
      <div className="mdd-head"><h2 id="mf-admin-title"><UserCog size={18} aria-hidden="true" />Roles del grupo</h2><small>Delegar administración</small></div>
      <form onSubmit={handleNominateRole} className="form-grid md-form mf-role-form">
        <label>Miembro
          <select value={nomineeId} onChange={(e) => setNomineeId(e.target.value)} required>
            <option value="">Seleccionar miembro</option>
            {profiles.filter((p) => p.id !== profile.id && p.membership_is_active).map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
          </select>
        </label>
        <label>Rol
          <select value={nomineeRole} onChange={(e) => setNomineeRole(e.target.value)}>
            <option value="admin">Administrador</option>
            <option value="super_admin">Super Administrador</option>
            <option value="player">Jugador</option>
          </select>
        </label>
        <div className="md-form-actions"><button type="submit" className="md-btn md-btn-accent">Asignar rol</button></div>
      </form>
    </section>
  );

  const accountBlock = (
    <section className="pv-section mf-account" aria-labelledby="mf-account-title">
      <div className="mdd-head"><h2 id="mf-account-title"><Users size={18} aria-hidden="true" />Grupos y cuenta</h2></div>
      <div className="pv-admin-inline">
        <button type="button" className="md-btn md-btn-ghost" onClick={onCreateGroup}>Crear mi propio grupo</button>
        {onSignOut && <button type="button" className="md-btn md-btn-ghost" onClick={onSignOut}><LogOut size={16} aria-hidden="true" /> Cerrar sesión</button>}
        {onDeleteAccount && (
          <button type="button" className="md-btn md-btn-ghost mf-danger" onClick={() => { if (window.confirm("¿Seguro que deseas eliminar tu cuenta permanentemente? Esta acción es irreversible.")) onDeleteAccount(); }}>
            <Trash2 size={16} aria-hidden="true" /> Eliminar mi cuenta
          </button>
        )}
      </div>
    </section>
  );

  return (
    <div className={`md-matches md-design-${variant} mf-page`} data-design={variant} data-view="mi-fifa">
      {isCommand ? (
        <div className="mdc pv pv-command">
          <div className="mdc-bar"><h1>Mi FIFA</h1><span className="mdc-pill">Identidad deportiva</span></div>
          <div className="pv-cc-hero">
            {cardBlock}
            <div className="pv-cc-hero-info">
              <PlayerIdentity profile={previewProfile} rating={ratingMap.get(profile?.id)} variant="command" />
              <StatTiles stats={stats} variant="command" compact />
              {onOpenAppearance && <AppearanceShortcut onOpen={onOpenAppearance} />}
            </div>
          </div>
          <div className="pv-cc-grid">
            {sections}
            {editForm}
            {adminBlock}
            {accountBlock}
          </div>
        </div>
      ) : (
        <div className="mde pv pv-editorial">
          <header className="pv-ed-hero">
            <div>
              <span className="mde-crumb">Mi FIFA · Identidad deportiva</span>
              <h1>{displayName(previewProfile)}</h1>
              <PlayerIdentity profile={previewProfile} rating={ratingMap.get(profile?.id)} variant="editorial" size="sm" />
              {onOpenAppearance && <AppearanceShortcut onOpen={onOpenAppearance} />}
            </div>
            {cardBlock}
          </header>
          <div className="pv-ed-body">
            {sections}
            {editForm}
            {adminBlock}
            {accountBlock}
          </div>
        </div>
      )}
    </div>
  );
}

/** Visible entry to Apariencia at the top of the profile (the full selector lives at /apariencia). */
function AppearanceShortcut({ onOpen }) {
  const { design, palette } = useAppearance();
  const d = DESIGNS.find((x) => x.id === design);
  const p = PALETTES.find((x) => x.id === palette);
  return (
    <button type="button" className="md-appearance-shortcut" onClick={onOpen}>
      <Palette size={20} aria-hidden="true" />
      <span>
        <b>Apariencia</b>
        <small>
          {d?.label} · {p?.label}
        </small>
      </span>
      <span className="md-appearance-shortcut-cta">
        Cambiar diseño <ChevronRight size={16} aria-hidden="true" />
      </span>
    </button>
  );
}
