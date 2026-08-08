import React from "react";

/**
 * F5Manager DesktopNav Component
 */
export function DesktopNav({
  navItems = [],
  activePage,
  goToPage,
}) {
  return (
    <nav className="f5-desktop-nav" aria-label="Navegación principal">
      {navItems.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`f5-nav-item ${isActive ? "is-active" : ""}`}
            onClick={() => goToPage(item.id)}
          >
            {item.icon && <span style={{ display: "inline-flex" }}>{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default DesktopNav;
