/**
 * F5 Manager — Formulario de interés para organizadores fundadores (Commercial Launch V1).
 *
 * Captura el interés de organizadores para el piloto "Organizer Pro Fundadores"
 * a través del endpoint serverless POST /api/founder-leads (validación,
 * honeypot y rate limiting persistente del lado servidor).
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "../api.js";
import { track } from "../analytics.js";

const FREQUENCIES = [
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
  { value: "ocasional", label: "Ocasional" },
];

const GROUP_SIZES = [
  { value: "5-9", label: "5 a 9 jugadores" },
  { value: "10-14", label: "10 a 14 jugadores" },
  { value: "15-22", label: "15 a 22 jugadores" },
  { value: "23+", label: "Más de 22 jugadores" },
];

export default function FounderInterestForm({ onClose, onSubmitted }) {
  const [form, setForm] = useState({
    contactName: "",
    email: "",
    city: "",
    groupFrequency: "semanal",
    groupSize: "10-14",
    consent: false,
    hp: "",
  });
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !submittingRef.current) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleChange = useCallback(
    (key, value) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (submittingRef.current || status === "sending" || status === "success") {
        return;
      }
      setError("");

      // Anti-spam en cliente (respaldado por validación en servidor).
      if (form.hp.trim()) {
        setStatus("idle");
        if (onSubmitted) onSubmitted(false);
        return;
      }

      if (form.contactName.trim().length < 2) {
        setError("Ingresá tu nombre de contacto.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
        setError("Ingresá un correo válido.");
        return;
      }
      if (form.city.trim().length < 2) {
        setError("Ingresá tu ciudad.");
        return;
      }
      if (!form.consent) {
        setError("Debés aceptar el consentimiento para continuar.");
        return;
      }

      submittingRef.current = true;
      setStatus("sending");
      try {
        await api.createFounderLead({
          contactName: form.contactName.trim(),
          email: form.email.trim(),
          city: form.city.trim(),
          groupFrequency: form.groupFrequency,
          groupSize: form.groupSize,
          consent: form.consent,
          source: "landing",
          hp: form.hp,
        });
        setStatus("success");
        track(
          "founders_interest_submitted",
          {
            city: form.city.trim(),
            group_frequency: form.groupFrequency,
            group_size: form.groupSize,
            source: "landing",
          },
          { dedupe: "milestone" },
        );
        if (onSubmitted) onSubmitted(true);
      } catch (err) {
        setStatus("error");
        setError(
          err?.message || "No se pudo enviar la solicitud. Intentá de nuevo más tarde.",
        );
      } finally {
        submittingRef.current = false;
      }
    },
    [form, onSubmitted, status],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="founder-modal-title"
      className="founder-interest"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 201,
        overflowY: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        pointerEvents: "none",
      }}
    >
      <div
        className="founder-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "calc(100vh - 2rem)",
          overflowY: "auto",
          background: "var(--surface-1, #0f172a)",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.14))",
          borderRadius: "16px",
          padding: "1.75rem",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={status === "sending"}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "transparent",
            border: "none",
            color: "var(--text-muted, #94a3b8)",
            cursor: status === "sending" ? "not-allowed" : "pointer",
            fontSize: "1.35rem",
            lineHeight: 1,
            padding: "0.25rem 0.4rem",
          }}
          aria-label="Cerrar formulario"
        >
          ✕
        </button>

        {status === "success" ? (
          <div style={{ paddingTop: "0.5rem" }}>
            <div
              aria-hidden="true"
              style={{
                fontSize: "3rem",
                marginBottom: "0.75rem",
                color: "var(--primary, #10b981)",
              }}
            >
              ✓
            </div>
            <h2
              id="founder-modal-title"
              style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "0.75rem", color: "var(--text, #ffffff)" }}
            >
              ¡Gracias por sumarte!
            </h2>
            <p style={{ color: "var(--text-muted, #94a3b8)", lineHeight: "1.6", marginBottom: "1.5rem" }}>
              Hemos recibido tu solicitud para ser organizador fundador. Te contactaremos
              personalmente para coordinar el piloto de 14 días sin costo ni compromiso.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                background: "transparent",
                color: "var(--primary, #10b981)",
                fontWeight: "700",
                border: "1px solid var(--primary, #10b981)",
                cursor: "pointer",
              }}
            >
              Volver a la landing
            </button>
          </div>
        ) : (
          <>
            <h2
              id="founder-modal-title"
              style={{ fontSize: "1.45rem", fontWeight: "800", marginBottom: "0.5rem", paddingRight: "2rem", color: "var(--text, #ffffff)" }}
            >
              Solicitar un lugar como fundador
            </h2>
            <p style={{ color: "var(--text-muted, #94a3b8)", lineHeight: "1.6", marginBottom: "1.25rem", fontSize: "0.95rem" }}>
              Buscamos a los primeros 10 organizadores para probar F5 Manager con
              acompañamiento durante 14 días, sin costo ni compromiso. Al terminar,
              podrás valorar una propuesta de Organizer Pro Fundadores desde Q49 al mes.
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#fca5a5",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.9rem" }}>
                <div>
                  <label htmlFor="founder-name" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.35rem" }}>
                    Nombre de contacto
                  </label>
                  <input
                    id="founder-name"
                    type="text"
                    maxLength={120}
                    placeholder="Tu nombre"
                    value={form.contactName}
                    onChange={(e) => handleChange("contactName", e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "0.7rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                      background: "rgba(0, 0, 0, 0.25)",
                      color: "var(--text, #ffffff)",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="founder-email" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.35rem" }}>
                    Correo electrónico
                  </label>
                  <input
                    id="founder-email"
                    type="email"
                    maxLength={254}
                    placeholder="tucorreo@ejemplo.com"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "0.7rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                      background: "rgba(0, 0, 0, 0.25)",
                      color: "var(--text, #ffffff)",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="founder-city" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.35rem" }}>
                  Ciudad
                </label>
                <input
                  id="founder-city"
                  type="text"
                  maxLength={120}
                  placeholder="Ej. Ciudad de Guatemala"
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.7rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                    background: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text, #ffffff)",
                    fontSize: "0.95rem",
                  }}
                />
              </div>
              <div>
                <label htmlFor="founder-frequency" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.35rem" }}>
                  ¿Con qué frecuencia organizas partidos?
                </label>
                <select
                  id="founder-frequency"
                  value={form.groupFrequency}
                  onChange={(e) => handleChange("groupFrequency", e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.7rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                    background: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text, #ffffff)",
                    fontSize: "0.95rem",
                  }}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="founder-group-size" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.35rem" }}>
                  ¿Cuántos jugadores tiene tu grupo aproximado?
                </label>
                <select
                  id="founder-group-size"
                  value={form.groupSize}
                  onChange={(e) => handleChange("groupSize", e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.7rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                    background: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text, #ffffff)",
                    fontSize: "0.95rem",
                  }}
                >
                  {GROUP_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", marginBottom: "0.25rem" }}>
                <input
                  id="founder-consent"
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => handleChange("consent", e.target.checked)}
                  style={{ marginTop: "0.2rem", accentColor: "var(--primary, #10b981)" }}
                />
                <label htmlFor="founder-consent" style={{ fontSize: "0.85rem", color: "var(--text, #ffffff)", lineHeight: "1.5", cursor: "pointer" }}>
                  Acepto que F5 Manager almacene mis datos para contactarme sobre el
                  piloto de organizadores fundadores. No hay cobros automáticos ni
                  compromiso de pago.
                </label>
              </div>

              {/* Honeypot anti-spam */}
              <input
                type="text"
                name="website"
                autoComplete="off"
                value={form.hp}
                onChange={(e) => handleChange("hp", e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                }}
              />

              <button
                type="submit"
                disabled={status === "sending"}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  borderRadius: "8px",
                  background: status === "sending" ? "var(--text-muted, #64748b)" : "linear-gradient(135deg, #10b981, #059669)",
                  color: "#ffffff",
                  fontWeight: "800",
                  fontSize: "1rem",
                  border: "none",
                  cursor: status === "sending" ? "not-allowed" : "pointer",
                  opacity: status === "sending" ? 0.65 : 1,
                }}
              >
                {status === "sending" ? "Enviando…" : "Solicitar lugar de fundador"}
              </button>

              <p style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)", textAlign: "center", margin: "0.4rem 0 0" }}>
                Participar en el piloto no obliga a contratar. Tus datos se usan solo
                para contactarte y nunca se exponen públicamente.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
