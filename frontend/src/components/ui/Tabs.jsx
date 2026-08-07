import React from "react";

/**
 * F5Manager Tabs Component
 *
 * @param {Object} props
 * @param {Array<{ id: string, label: string, icon?: React.ReactNode, badge?: string | number }>} props.tabs
 * @param {string} props.activeTab
 * @param {(id: string) => void} props.onTabChange
 */
export function Tabs({
  tabs = [],
  activeTab,
  onTabChange,
  className = "",
  ...rest
}) {
  return (
    <div className={`f5-tabs-container ${className}`.trim()} {...rest}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            className={`f5-tab-button ${isActive ? "is-active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "10px",
                  background: isActive ? "var(--primary)" : "rgba(255,255,255,0.1)",
                  color: isActive ? "#000" : "var(--text-secondary)",
                  fontWeight: "700"
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
