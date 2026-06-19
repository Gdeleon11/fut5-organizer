import { attendanceLabel, displayName } from "../utils.js";

/**
 * Shows the confirm / cancel attendance control for the current player.
 *
 * Props:
 *   attendance   – current attendance row (may be null)
 *   match        – match object
 *   onConfirm    – () => void
 *   onCancel     – () => void  (triggers late-cancel fine)
 *   profile      – current player profile (with is_active flag)
 *   fineAmount   – amount that will be charged on cancellation (from settings)
 */
export default function AttendanceAction({
  attendance,
  match,
  onConfirm,
  onCancel,
  profile,
  fineAmount,
}) {
  const isUpcoming = match.status === "upcoming";
  const isActive = Boolean(profile?.is_active);
  const status = attendance?.status;
  const isConfirmed = ["confirmed", "checked_in"].includes(status);
  const isCanceled = status === "canceled";
  const isNoShow = status === "no_show";
  const isCheckedIn = status === "checked_in";

  // Determine confirm button state
  const confirmDisabled = isConfirmed || !isActive || !isUpcoming;
  let confirmLabel = "Confirmar asistencia";
  let message = "Un toque confirma tu lugar.";

  if (!isActive) {
    confirmLabel = "Inactivo";
    message = "Pedile a un admin que active tu perfil.";
  } else if (!isUpcoming) {
    confirmLabel = "Cerrado";
    message = "Este partido no está abierto para confirmar.";
  } else if (isCheckedIn) {
    confirmLabel = "Registrado";
    message = attendanceLabel(status, attendance?.checked_in);
  } else if (isConfirmed) {
    confirmLabel = "Confirmado";
    message = attendanceLabel(status, attendance?.checked_in);
  } else if (isCanceled) {
    confirmLabel = "Cancelaste";
    message = fineAmount
      ? `Cancelaste. Se generó una multa de Q${fineAmount}.`
      : "Cancelaste tu asistencia.";
  } else if (isNoShow) {
    confirmLabel = "No llegaste";
    message = "El admin te marcó como ausente.";
  }

  // Cancel is only available if confirmed (not yet checked-in) and match is upcoming
  const canCancel = isConfirmed && !isCheckedIn && isUpcoming;

  return (
    <div className="self-confirm">
      <div>
        <strong>{displayName(profile)}</strong>
        <small>{message}</small>
      </div>
      <div className="attendance-buttons">
        <button
          className={isConfirmed ? "confirmed-button" : ""}
          disabled={confirmDisabled}
          type="button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        {canCancel && onCancel && (
          <button
            className="secondary-button cancel-attendance-btn"
            type="button"
            onClick={onCancel}
          >
            Cancelar asistencia
            {fineAmount ? ` (multa Q${fineAmount})` : ""}
          </button>
        )}
      </div>
    </div>
  );
}
