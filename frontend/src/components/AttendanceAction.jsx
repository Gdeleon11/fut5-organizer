import { attendanceLabel, displayName } from "../utils.js";

export default function AttendanceAction({
  attendance,
  match,
  isFull,
  waitlistPos,
  onConfirm,
  onJoinWaitlist,
  onCancel,
  profile,
  fineAmount,
}) {
  const isUpcoming = match.status === "upcoming";
  const isActive = Boolean(profile?.is_active);
  const status = attendance?.status;
  const isConfirmed = ["confirmed", "checked_in"].includes(status);
  const isWaitlisted = status === "waitlist";
  const isCanceled = status === "canceled";
  const isNoShow = status === "no_show";
  const isCheckedIn = status === "checked_in";

  const confirmDisabled = isConfirmed || !isActive || !isUpcoming || isWaitlisted;
  const waitlistDisabled = isConfirmed || isWaitlisted || !isActive || !isUpcoming;
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
  } else if (isWaitlisted) {
    confirmLabel = `En lista (#${waitlistPos || "?"})`;
    message = `Estás en la lista de espera. Posición: #${waitlistPos || "?"}`;
  } else if (isCanceled) {
    confirmLabel = "Cancelaste";
    message = fineAmount
      ? `Cancelaste. Se generó una multa de Q${fineAmount}.`
      : "Cancelaste tu asistencia.";
  } else if (isNoShow) {
    confirmLabel = "No llegaste";
    message = "El admin te marcó como ausente.";
  } else if (isFull) {
    confirmLabel = "Lleno";
    message = "Este partido está lleno. Unite a la lista de espera.";
  }

  const canCancel = (isConfirmed || isWaitlisted) && !isCheckedIn && isUpcoming;

  return (
    <div className="self-confirm">
      <div>
        <strong>{displayName(profile)}</strong>
        <small>{message}</small>
      </div>
      <div className="attendance-buttons">
        {isFull && !isConfirmed && !isWaitlisted ? (
          <button
            className="secondary-button"
            disabled={waitlistDisabled}
            type="button"
            onClick={onJoinWaitlist}
          >
            Lista de espera
          </button>
        ) : (
          <button
            className={isConfirmed ? "confirmed-button" : ""}
            disabled={confirmDisabled}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        )}
        {canCancel && onCancel && (
          <button
            className="secondary-button cancel-attendance-btn"
            type="button"
            onClick={onCancel}
          >
            Cancelar asistencia
          </button>
        )}
      </div>
    </div>
  );
}
