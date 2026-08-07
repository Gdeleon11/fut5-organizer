import React from "react";

/**
 * F5Manager Card Surface Component
 *
 * @param {Object} props
 * @param {'default' | 'glass' | 'hero'} [props.variant='default']
 * @param {boolean} [props.interactive=false]
 * @param {React.ReactNode} props.children
 */
export function Card({
  variant = "default",
  interactive = false,
  className = "",
  children,
  ...rest
}) {
  const variantClass = variant !== "default" ? `f5-card--${variant}` : "";
  const interactiveClass = interactive ? "f5-card--interactive" : "";

  return (
    <div
      className={`f5-card ${variantClass} ${interactiveClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
