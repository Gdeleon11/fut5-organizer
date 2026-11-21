import React, { useEffect, useRef, useState } from "react";
import { Bell, Layers, LogOut, PanelLeft, Palette, RefreshCw, Users } from "lucide-react";
import Avatar from "../Avatar.jsx";
import GroupSwitcher from "./GroupSwitcher.jsx";
import PushNotifications from "../PushNotifications.jsx";
import { displayName } from "../../utils.js";
import { useAppearance } from "../../appearance/AppearanceProvider.jsx";
import { DESIGNS, PALETTES } from "../../appearance/appearance.js";

function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

const MODE_KEY = (variant) => `f5_sidebar_mode_${variant}`;

function readMode(variant) {
  try {
    const v = window.localStorage.getItem(MODE_KEY(variant));
    if (v === "rail" || v === "expanded") return v;
  } catch {
    /* storage unavailable */
  }
  return "auto";
}

/**
 * Desktop navigation (≥ 900px). Two variants share the same data:
 * - editorial: 240px with labels; auto-collapses to a 72px icon rail below 1280px.
 * - command:   76px icon rail with tooltips by default, expandable to 232px.
 * Mobile keeps AppHeader + MobileBottomNav (security-release fixes untouched).
 */
export function AppSidebar({
  variant = "editorial",
  navItems = [],
  activePage,
  goToPage,
  memberships = [],
  activeGroupId,
  switchGroup,
  profile,
  preferredPositionShort,
  userRating,
  refresh,
  signOut,
  bell = null,
}) {
  const [mode, setMode] = useState(() => readMode(variant));
  const isNarrow = useMediaQuery("(max-width: 1279px)");
  const [groupOpen, setGroupOpen] = useState(false);
  const groupRef = useRef(null);

  useEffect(() => setMode(readMode(variant)), [variant]);

  const autoRail = variant === "command" ? true : isNarrow;
  const isRail = mode === "auto" ? autoRail : mode === "rail";

  function toggle() {
    const next = isRail ? "expanded" : "rail";
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY(variant), next);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!groupOpen) return undefined;
    function onDoc(e) {
      if (groupRef.current && !groupRef.current.contains(e.target)) setGroupOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setGroupOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [groupOpen]);

  const { design: currentDesign, palette: currentPalette } = useAppearance();
  const designLabel = (DESIGNS.find((d) => d.id === currentDesign)?.label || "").replace("Sports ", "");
  const paletteLabel = PALETTES.find((p) => p.id === currentPalette)?.label || "";
  const activeGroup = memberships.find((m) => m.group_id === activeGroupId) || memberships[0];
  const groupName = activeGroup?.groups?.name || "Grupo";
  const name = displayName(profile);

  return (
    <aside
      className={`md-side md-side-${variant}${isRail ? " is-rail" : " is-wide"}`}
      aria-label="Barra lateral F5 Manager"
    >
      <button type="button" className="md-brand" onClick={() => goToPage("matches")} aria-label="F5 Manager — ir a Partidos">
        <img src="/brand/f5manager-logo.jpg" alt="" />
        <span className="md-brand-text">
          <b>F5MANAGER</b>
          <small>Matchday</small>
        </span>
      </button>

      {memberships.length > 0 &&
        (isRail ? (
          <div className="md-group-rail" ref={groupRef}>
            <button
              type="button"
              className="md-tool"
              data-tip={`Grupo: ${groupName}`}
              aria-label={`Cambiar grupo (actual: ${groupName})`}
              aria-expanded={groupOpen}
              onClick={() => setGroupOpen((v) => !v)}
            >
              <Users size={19} aria-hidden="true" />
            </button>
            {groupOpen && (
              <div className="md-pop" role="menu" aria-label="Grupos">
                {memberships.map((m) => (
                  <button
                    key={m.group_id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={m.group_id === activeGroupId}
                    className={m.group_id === activeGroupId ? "is-active" : ""}
                    onClick={() => {
                      setGroupOpen(false);
                      if (m.group_id !== activeGroupId) switchGroup(m.group_id);
                    }}
                  >
                    {m.groups?.name || "Chamusca"}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="md-group">
            <span className="md-label">Grupo</span>
            <GroupSwitcher memberships={memberships} activeGroupId={activeGroupId} switchGroup={switchGroup} />
          </div>
        ))}

      <nav aria-label="Principal">
        <ul className="md-nav">
          {navItems.map((item) => {
            const isActive = activePage === item.id || (item.id === "matches" && activePage === "match");
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`md-nav-btn${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={isRail ? item.label : undefined}
                  data-tip={item.label}
                  onClick={() => goToPage(item.id)}
                >
                  <span className="md-nav-ic" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="md-nav-text">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Preferencias: labelled entry so changing design/palette is easy to find */}
      <div className="md-side-prefs">
        {!isRail && <span className="md-label">Preferencias</span>}
        <button
          type="button"
          className={`md-nav-btn md-appearance-entry${activePage === "appearance" ? " is-active" : ""}`}
          aria-current={activePage === "appearance" ? "page" : undefined}
          aria-label={isRail ? `Apariencia: ${designLabel} · ${paletteLabel}` : undefined}
          data-tip={`Apariencia · ${designLabel}`}
          onClick={() => goToPage("appearance")}
        >
          <span className="md-nav-ic" aria-hidden="true">
            <Palette size={20} />
          </span>
          <span className="md-nav-text">
            Apariencia
            <small>
              {designLabel} · {paletteLabel}
            </small>
          </span>
        </button>
      </div>

      <div className="md-dock">
        {!isRail && (
          <div className="md-push">
            <PushNotifications profile={profile} />
          </div>
        )}
        <div className="md-tools">
          {bell}
          {isRail && (
            <button type="button" className="md-tool" data-tip="Notificaciones" aria-label="Notificaciones" onClick={toggle}>
              <Bell size={18} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="md-tool" data-tip="Mis grupos" aria-label="Mis grupos" onClick={() => goToPage("groups")}>
            <Layers size={18} aria-hidden="true" />
          </button>
          <button type="button" className="md-tool" data-tip="Actualizar datos" aria-label="Actualizar datos" onClick={refresh}>
            <RefreshCw size={18} aria-hidden="true" />
          </button>
          <button type="button" className="md-tool is-danger" data-tip="Cerrar sesión" aria-label="Cerrar sesión" onClick={signOut}>
            <LogOut size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="md-tool"
            data-tip={isRail ? "Expandir menú" : "Contraer menú"}
            aria-label={isRail ? "Expandir menú" : "Contraer menú"}
            aria-pressed={!isRail}
            onClick={toggle}
          >
            <PanelLeft size={18} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="md-me"
          onClick={() => goToPage("profile")}
          data-tip={`${name} · ${preferredPositionShort || "JUG"} · OVR ${userRating}`}
          aria-label={`Perfil de ${name}`}
        >
          <Avatar profile={profile} size="sm" />
          <span className="md-me-text">
            <b>{name}</b>
            <small>
              {preferredPositionShort || "JUG"} · OVR {userRating}
            </small>
          </span>
        </button>
      </div>
    </aside>
  );
}

export default AppSidebar;
