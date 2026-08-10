import React, { useState, useRef, useEffect } from "react";
import Avatar from "../Avatar.jsx";
import ThemeSwitcher from "../ThemeSwitcher.jsx";
import { displayName } from "../../utils.js";
import { ChevronDown, RefreshCw, LogOut, UserCircle, Palette } from "lucide-react";

/**
 * F5Manager UserMenu Component
 */
export function UserMenu({
  profile,
  preferredPositionShort,
  userRating,
  refresh,
  signOut,
  goToPage,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!profile) return null;

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      {/* Menu Trigger Button */}
      <button
        type="button"
        className="f5-user-menu-trigger"
        aria-label="Menú de usuario"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Avatar profile={profile} size={32} />
        <div style={{ textAlign: "left" }} className="desktop-only-user-text">
          <span style={{ fontWeight: "700", color: "#ffffff", display: "block", fontSize: "0.82rem", lineHeight: "1.1" }}>
            {displayName(profile)}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.68rem", display: "block" }}>
            {preferredPositionShort} · OVR {userRating}
          </span>
        </div>
        <ChevronDown size={14} style={{ color: "var(--text-muted)", transition: "transform 180ms ease", transform: isOpen ? "rotate(180deg)" : "none" }} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="f5-user-menu-panel">
          <div className="f5-user-menu-header">
            <span style={{ fontWeight: "700", color: "#ffffff", display: "block", fontSize: "0.88rem" }}>
              {displayName(profile)}
            </span>
            <span style={{ color: "var(--primary)", fontSize: "0.72rem", fontWeight: "600" }}>
              {preferredPositionShort} · OVR {userRating}
            </span>
          </div>

          <button
            type="button"
            className="f5-user-menu-item"
            onClick={() => {
              setIsOpen(false);
              goToPage("profile");
            }}
          >
            <UserCircle size={16} className="f5-text-primary" />
            <span>Mi FIFA Card</span>
          </button>

          <div className="f5-user-menu-item" style={{ justifyContent: "space-between", cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Palette size={16} className="f5-text-info" />
              <span>Tema</span>
            </div>
            <ThemeSwitcher />
          </div>

          <button
            type="button"
            className="f5-user-menu-item"
            onClick={() => {
              setIsOpen(false);
              refresh();
            }}
          >
            <RefreshCw size={16} className="f5-text-warning" />
            <span>Actualizar Datos</span>
          </button>

          <div style={{ height: "1px", background: "var(--border-subtle)", margin: "0.2rem 0" }} />

          <button
            type="button"
            className="f5-user-menu-item is-danger"
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
