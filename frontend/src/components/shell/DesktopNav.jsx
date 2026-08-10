import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

/**
 * F5Manager DesktopNav Component
 * Handles primary links and responsive "Más ▾" overflow menu for super_admin / constrained viewports
 */
export function DesktopNav({
  navItems = [],
  activePage,
  goToPage,
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    }
    if (isMoreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMoreOpen]);

  const primaryItems = navItems.slice(0, 4);
  const overflowItems = navItems.slice(4);
  const hasOverflow = overflowItems.length > 0;
  const isOverflowActive = overflowItems.some((item) => item.id === activePage);

  return (
    <nav className="f5-desktop-nav" aria-label="Navegación principal">
      {/* Primary Links (Always visible) */}
      <div className="f5-desktop-nav-primary">
        {primaryItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`f5-nav-item ${isActive ? "is-active" : ""}`}
              onClick={() => goToPage(item.id)}
            >
              {item.icon && <span className="f5-nav-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Direct Secondary Links (Visible on >= 1180px) */}
      {hasOverflow && (
        <div className="f5-desktop-nav-secondary">
          {overflowItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`f5-nav-item ${isActive ? "is-active" : ""}`}
                onClick={() => goToPage(item.id)}
              >
                {item.icon && <span className="f5-nav-icon">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* "Más" Popover Dropdown (Visible on < 1180px when overflow items exist) */}
      {hasOverflow && (
        <div className="f5-desktop-nav-more-wrapper" ref={moreRef}>
          <button
            type="button"
            className={`f5-nav-item ${isOverflowActive ? "is-active" : ""}`}
            onClick={() => setIsMoreOpen((prev) => !prev)}
            aria-expanded={isMoreOpen}
            aria-haspopup="true"
          >
            <span>Más</span>
            <ChevronDown
              size={14}
              style={{
                transition: "transform 180ms ease",
                transform: isMoreOpen ? "rotate(180deg)" : "none",
              }}
            />
          </button>

          {isMoreOpen && (
            <div className="f5-desktop-nav-more-panel">
              {overflowItems.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`f5-user-menu-item ${isActive ? "is-active" : ""}`}
                    onClick={() => {
                      setIsMoreOpen(false);
                      goToPage(item.id);
                    }}
                  >
                    {item.icon && <span className="f5-nav-icon">{item.icon}</span>}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export default DesktopNav;
