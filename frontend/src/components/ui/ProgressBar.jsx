import React from "react";

/**
 * F5Manager ProgressBar Component
 *
 * @param {Object} props
 * @param {number} props.value
 * @param {number} props.max
 * @param {string} [props.label]
 * @param {boolean} [props.showCount=true]
 */
export function ProgressBar({
  value,
  max,
  label,
  showCount = true,
  className = "",
  ...rest
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / (max || 1)) * 100)));
  const isFull = value >= max;

  return (
    <div className={`f5-progress-wrapper ${className}`.trim()} {...rest}>
      {(label || showCount) && (
        <div className="f5-progress-header">
          {label && <span style={{ fontWeight: "600", color: "var(--text-secondary)" }}>{label}</span>}
          {showCount && (
            <span style={{ fontWeight: "700", color: isFull ? "var(--warning)" : "var(--text)" }}>
              {value} / {max}
            </span>
          )}
        </div>
      )}
      <div className="f5-progress-track">
        <div
          className={`f5-progress-fill ${isFull ? "f5-progress-fill--full" : ""}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
