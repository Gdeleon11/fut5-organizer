/**
 * F5 Manager — Formulario de interés para organizadores fundadores (Commercial Launch V1).
 *
 * Captura el interés de organizadores para el piloto "Organizer Pro Fundadores".
 * Solicita solo la información necesaria, con consentimiento explícito y
 * almacenamiento privado (RLS: solo admins pueden leer).
 *
 * Incluye un campo honeypot oculto como sistema básico anti-spam: si se rellena,
 * el envío se descarta sin avisar al usuario.
 */
import { useState, useCallback } from "react";
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
    hp: "", // honeypot: campo oculto anti-spam
  });
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [error, setError] = useState("");

  const handleChange = useCallback(
    (key, value) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");

      // Anti-spam: si el honeypot se relleno, se descarta el envío silenciosamente.
      if (form.hp.trim()) {
        setStatus("idle");
        if (onSubmitted) onSubmitted(false);
        return;
      }

      if (!form.contactName.trim()) {
        setError("Ingresá tu nombre de contacto.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setError("Ingresá un correo válido.");
        return;
      }
      if (!form.city.trim()) {
        setError("Ingresá tu ciudad.");
        return;
      }
      if (!form.consent) {
        setError("Debés aceptar el consentimiento para continuar.");
        return;
      }

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
        });
        setStatus("success");
        track("founders_interest_submitted", {
          city: form.city.trim(),
          group_frequency: form.groupFrequency,
          group_size: form.groupSize,
        });
        if (onSubmitted) onSubmitted(true);
      } catch (err) {
        setStatus("error");
        setError("No se pudo enviar la solicitud. Intentá de nuevo más tarde.");
      }
    },
    [form, onSubmitted],
  );

  return (
    <section
      className="founder-interest"
      style={{
        maxWidth: "560px",
        margin: "0 auto",
        padding: "2rem 1rem",
      }}
    >
      <div
        className="founder-card"
        style={{
          background: "var(--surface-1, #0f172a)",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
          borderRadius: "16px",
          padding: "2rem",
        }}
      >
        {status === "success" ? (
          <>
            <div
              style={{
                fontSize: "3rem",
                marginBottom: "1rem",
                color: "var(--primary, #10b981)",
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "0.75rem", color: "var(--text, #ffffff)" }}>
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
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "transparent",
                border: "none",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                fontSize: "1.5rem",
                lineHeight: 1,
              }}
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "0.5rem", color: "var(--text, #ffffff)" }}>
              Solicitar un lugar como fundador
            </h2>
            <p style={{ color: "var(--text-muted, #94a3b8)", lineHeight: "1.6", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
              Buscamos a los primeros 10 organizadores para probar F5 Manager con
              acompañamiento durante 14 días, sin costo ni compromiso. Al terminar,
              podrás valorar una propuesta de Organizer Pro Fundadores desde Q49 al mes.
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
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

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label htmlFor="founder-name" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.4rem" }}>
                    Nombre de contacto
                  </label>
                  <input
                    id="founder-name"
                    type="text"
                    placeholder="Tu nombre"
                    value={form.contactName}
                    onChange={(e) => handleChange("contactName", e.target.value)}
                    style={{
                      width: "100%",
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
                  <label htmlFor="founder-email" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.4rem" }}>
                    Correo electrónico
                  </label>
                  <input
                    id="founder-email"
                    type="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    style={{
                      width: "100%",
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
                <label htmlFor="founder-city" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.4rem" }}>
                  Ciudad
                </label>
                <input
                  id="founder-city"
                  type="text"
                  placeholder="Ej. Ciudad de Guatemala"
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  style={{
                    width: "100%",
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
                <label htmlFor="founder-frequency" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.4rem" }}>
                  ¿Con qué frecuencia organizas partidos?
                </label>
                <select
                  id="founder-frequency"
                  value={form.groupFrequency}
                  onChange={(e) => handleChange("groupFrequency", e.target.value)}
                  style={{
                    width: "100%",
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
                <label htmlFor="founder-group-size" style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "var(--text, #ffffff)", marginBottom: "0.4rem" }}>
                  ¿Cuántos jugadores tiene tu grupo aproximado?
                </label>
                <select
                  id="founder-group-size"
                  value={form.groupSize}
                  onChange={(e) => handleChange("groupSize", e.target.value)}
                  style={{
                    width: "100%",
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
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", marginBottom: "0.5rem" }}>
                <input
                  id="founder-consent"
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => handleChange("consent", e.target.checked)}
                  style={{ marginTop: "0.15rem", accentColor: "var(--primary, #10b981)" }}
                />
                <label htmlFor="founder-consent" style={{ fontSize: "0.85rem", color: "var(--text, #ffffff)", lineHeight: "1.5", cursor: "pointer" }}>
                  Acepto que F5 Manager almacene mis datos para contactarme sobre el
                  piloto de organizadores fundadores. No hay cobros automáticos ni
                  compromiso de pago.
                </label>
              </div>

              {/* Honeypot anti-spam: oculto visualmente, si se rellena se descarta. */}
              <input
                type="text"
                name="website"
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
                  opacity: status === "sending" ? 0.6 : 1,
                }}
              >
                {status === "sending" ? "Enviando…" : "Solicitar lugar de fundador"}
              </button>

              <p style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)", textAlign: "center", marginTop: "0.75rem" }}>
                Participar en el piloto no obliga a contratar. Tus datos se usan solo
                para contactarte y nunca se exponen públicamente.
              </p>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
