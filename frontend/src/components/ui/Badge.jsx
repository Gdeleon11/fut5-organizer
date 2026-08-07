import React from "react";

/**
 * F5Manager Badge Pill Component
 *
 * @param {Object} props
 * @param {'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'} [props.variant='neutral']
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} props.children
 */
export function Badge({
  variant = "neutral",
  icon = null,
  className = "",
  children,
  ...rest
}) {
  return (
    <span
      className={`f5-badge f5-badge--${variant} ${className}`.trim()}
      {...rest}
    >
      {icon && <span className="f5-badge-icon">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

export default Badge;
