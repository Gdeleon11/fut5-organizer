import React from "react";
import { Loader2 } from "lucide-react";

/**
 * F5Manager Reusable Button Component
 *
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'success' | 'danger' | 'ghost'} [props.variant='primary']
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {boolean} [props.fullWidth=false]
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} props.children
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  icon = null,
  children,
  className = "",
  type = "button",
  ...rest
}) {
  const sizeClass = size !== "md" ? `f5-btn--${size}` : "";
  const variantClass = `f5-btn--${variant}`;
  const fullClass = fullWidth ? "f5-btn--full" : "";
  const loadingClass = loading ? "f5-btn--loading" : "";

  return (
    <button
      type={type}
      className={`f5-btn ${variantClass} ${sizeClass} ${fullClass} ${loadingClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />
      ) : icon ? (
        <span className="f5-btn-icon">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export default Button;
