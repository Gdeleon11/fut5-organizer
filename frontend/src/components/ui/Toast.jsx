import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * F5Manager Toast / Visual Feedback Banner Component
 *
 * @param {Object} props
 * @param {'success' | 'warning' | 'danger' | 'info'} [props.variant='info']
 * @param {string} props.message
 * @param {() => void} [props.onClose]
 */
export function Toast({
  variant = "info",
  message,
  onClose,
  className = "",
  ...rest
}) {
  if (!message) return null;

  const iconMap = {
    success: <CheckCircle2 size={18} className="text-emerald-400" />,
    warning: <AlertCircle size={18} className="text-amber-400" />,
    danger: <AlertCircle size={18} className="text-rose-400" />,
    info: <Info size={18} className="text-blue-400" />,
  };

  return (
    <div className={`f5-toast f5-toast--${variant} ${className}`.trim()} {...rest}>
      {iconMap[variant]}
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "0.2rem" }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default Toast;
