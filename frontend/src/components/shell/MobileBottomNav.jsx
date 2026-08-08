import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Trophy } from "lucide-react";

/**
 * F5Manager MobileBottomNav Component
 */
export function MobileBottomNav({
  navItems = [],
  activePage,
  goToPage,
  mobileNavRefs,
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMoreMenu]);

  // If 5 items or fewer, render directly
  const hasMoreItems = navItems.length > 5;
  const mainItems = hasMoreItems ? navItems.slice(0, 4) : navItems;
  const overflowItems = hasMoreItems ? navItems.slice(4) : [];
  const isOverflowActive = overflowItems.some((i) => i.id === activePage);

  return (
    <>
      {/* Overflow Menu for Super Admin extra items */}
      {showMoreMenu && hasMoreItems && (
        <div
          ref={moreMenuRef}
          style={{
            position: "fixed",
            bottom: "calc(4.2rem + env(safe-area-inset-bottom, 0px))",
            right: "1rem",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "0.5rem",
            boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            minWidth: "160px"
          }}
        >
          {overflowItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  background: isActive ? "rgba(16, 185, 129, 0.15)" : "transparent",
                  border: "none",
                  borderRadius: "var(--r-sm)",
                  color: isActive ? "var(--primary)" : "var(--text)",
                  fontWeight: isActive ? "700" : "500",
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
                onClick={() => {
                  setShowMoreMenu(false);
                  goToPage(item.id);
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Primary Mobile Bottom Nav */}
      <nav className="bottom-nav" aria-label="Principal móvil">
        {mainItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-item ${isActive ? "is-active" : ""}`}
              ref={(node) => {
                if (mobileNavRefs && mobileNavRefs.current) {
                  mobileNavRefs.current[item.id] = node;
                }
              }}
              onClick={() => {
                setShowMoreMenu(false);
                goToPage(item.id);
              }}
              title={item.label}
            >
              <span className="tab-icon">{item.icon}</span>
              <span className="tab-label">{item.mobileLabel || item.label}</span>
            </button>
          );
        })}

        {/* 5th button: "Más" when overflow items exist */}
        {hasMoreItems && (
          <button
            type="button"
            className={`bottom-nav-item ${isOverflowActive ? "is-active" : ""}`}
            onClick={() => setShowMoreMenu((prev) => !prev)}
            title="Más opciones"
          >
            <span className="tab-icon">
              {isOverflowActive && overflowItems.find((i) => i.id === activePage)?.icon ? (
                overflowItems.find((i) => i.id === activePage).icon
              ) : (
                <MoreHorizontal size={20} />
              )}
            </span>
            <span className="tab-label">
              {isOverflowActive
                ? overflowItems.find((i) => i.id === activePage)?.mobileLabel || "Más"
                : "Más"}
            </span>
          </button>
        )}
      </nav>
    </>
  );
}

export default MobileBottomNav;
