import React from "react";

/**
 * F5Manager SectionHeader Component
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.action]
 * @param {React.ReactNode} [props.icon]
 */
export function SectionHeader({
  title,
  subtitle,
  action,
  icon,
  className = "",
  ...rest
}) {
  return (
    <div className={`f5-section-header ${className}`.trim()} {...rest}>
      <div>
        <h2 className="f5-section-title">
          {icon && <span className="f5-section-header-icon">{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="f5-section-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="f5-section-action">{action}</div>}
    </div>
  );
}

export default SectionHeader;
