import React from "react";

/**
 * F5Manager StatCard Metric Display Component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon
 * @param {string} props.label
 * @param {React.ReactNode} props.value
 * @param {string} [props.subtext]
 */
export function StatCard({
  icon,
  label,
  value,
  subtext,
  className = "",
  ...rest
}) {
  return (
    <div className={`f5-stat-card ${className}`.trim()} {...rest}>
      {icon && <div className="f5-stat-icon">{icon}</div>}
      <div className="f5-stat-info">
        <span className="f5-stat-label">{label}</span>
        <span className="f5-stat-value">{value}</span>
        {subtext && <small style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{subtext}</small>}
      </div>
    </div>
  );
}

export default StatCard;
