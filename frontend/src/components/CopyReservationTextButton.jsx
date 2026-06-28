import { useState } from "react";
import { generateReservationText } from "../reservationAssistant.js";

export default function CopyReservationTextButton({
  match,
  attendances = [],
  profiles = [],
  onCopied,
  className = "secondary-button",
}) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    const text = generateReservationText({ match, attendances, profiles });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied?.("Texto copiado al portapapeles");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt("Copiá este texto:", text);
    }
  }

  return (
    <button className={className} type="button" onClick={copyText}>
      <span aria-hidden="true">📋</span> {copied ? "Texto copiado" : "Copiar texto de reserva"}
    </button>
  );
}
