import React from "react";

/**
 * F5Manager IconButton Component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon
 * @param {string} [props.title]
 * @param {boolean} [props.disabled=false]
 */
export function IconButton({
  icon,
  title,
  disabled = false,
  className = "",
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`f5-icon-btn ${className}`.trim()}
      {...rest}
    >
      {icon}
    </button>
  );
}

export default IconButton;
