import React, { useState } from "react";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";

export default function FaqPage({ onNavigate }) {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      q: "¿F5Manager es totalmente gratuito para los grupos de fútbol?",
      a: "Sí, las funciones principales para organizar partidos, convocar jugadores, armar equipos con IA, llevar estadísticas tipo Fifa Card y administrar la tesorería son de libre acceso para los organizadores y jugadores."
    },
    {
      q: "¿Cómo funciona el algoritmo de Inteligencia Artificial para armar los equipos?",
      a: "El algoritmo analiza los atributos de cada jugador en 4 áreas principales (Ataque, Mediocampo, Defensa y Portería), ajustando el valor OVR según los resultados de los últimos partidos disputados. Luego ejecuta una optimización combinatoria para minimizar la diferencia total entre los equipos."
    },
    {
      q: "¿Cómo gestiona F5Manager el cobro de la cuota de la cancha y las multas?",
      a: "Cada partido tiene asignado un costo total. El sistema calcula la cuota individual por jugador según los asistentes confirmados. Los jugadores pueden subir fotos de sus comprobantes de pago por transferencia y el organizador aprueba el ingreso. Además, se pueden parametrizar multas por ausencias sin aviso previo."
    },
    {
      q: "¿Es necesario que todos los jugadores descarguen una app?",
      a: "No obligatoriamente. F5Manager es una aplicación web progresiva (PWA) que funciona desde cualquier navegador móvil o de escritorio sin descargar nada desde tiendas. El organizador puede añadir jugadores o invitados manuales en caso de que alguien no se registre inmediatamente."
    },
    {
      q: "¿Puedo administrar más de un grupo de fútbol con la misma cuenta?",
      a: "Sí. Puedes ser superadministrador de un grupo de los miércoles, jugador en una liga de fin de semana y tesorero de tu equipo de torneo. La plataforma permite alternar entre grupos fácilmente."
    },
    {
      q: "¿Cómo se actualizan las Fifa Cards y estadísticas de los jugadores?",
      a: "Al finalizar un partido, los organizadores o participantes registran el marcador final, quién anotó goles, dio asistencias y quién fue elegido MVP del encuentro. El sistema recalcula en tiempo real las métricas e insignias de cada tarjeta."
    },
    {
      q: "¿Cómo puedo integrar F5Manager con mi complejo deportivo o alquiler de canchas?",
      a: "Los propietarios o encargados de canchas pueden registrar sus sedes en la sección de reservas para recibir solicitud de disponibilidad y comprobantes de anticipos directamente de los administradores de grupo."
    }
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #090d16)", color: "var(--text, #ffffff)" }}>
      <PublicHeader activePath="/faq" onNavigate={onNavigate} />
      
      <main style={{ flex: 1, maxWidth: "900px", margin: "0 auto", padding: "3rem 1.5rem", width: "100%" }}>
        <header style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <h1 style={{ fontSize: "3rem", fontWeight: "900", background: "linear-gradient(90deg, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "1rem" }}>
            Preguntas Frecuentes
          </h1>
          <p style={{ fontSize: "1.2rem", color: "var(--text-muted, #94a3b8)", maxWidth: "700px", margin: "0 auto", lineHeight: "1.6" }}>
            Respuestas a las dudas más comunes sobre la plataforma F5Manager, suscripciones, algoritmos e integración de equipos.
          </p>
        </header>

        <section style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "4rem" }}>
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                style={{
                  background: "var(--surface-1, #0f172a)",
                  borderRadius: "14px",
                  border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                  overflow: "hidden",
                  transition: "all 0.2s ease"
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  style={{
                    width: "100%",
                    padding: "1.5rem",
                    background: "transparent",
                    border: "none",
                    color: "var(--text, #ffffff)",
                    fontWeight: "700",
                    fontSize: "1.1rem",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem"
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ fontSize: "1.25rem", color: "var(--primary, #10b981)", transition: "transform 0.2s ease", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    ▼
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 1.5rem 1.5rem", color: "var(--text-muted, #cbd5e1)", lineHeight: "1.7", fontSize: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <p style={{ margin: "1rem 0 0" }}>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section style={{ textAlign: "center", background: "var(--surface-1, #0f172a)", padding: "2.5rem", borderRadius: "16px", border: "1px solid var(--border, rgba(255, 255, 255, 0.1))" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.75rem", fontWeight: "800" }}>¿Tienes una pregunta diferente?</h2>
          <p style={{ color: "var(--text-muted, #94a3b8)", marginBottom: "1.5rem" }}>Estamos disponibles para resolver tus consultas técnicas o administrativas.</p>
          <a
            href="/contacto"
            onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate("/contacto") : window.location.href = "/contacto"; }}
            style={{ display: "inline-block", padding: "0.75rem 1.75rem", borderRadius: "8px", background: "var(--primary, #10b981)", color: "#ffffff", fontWeight: "bold", textDecoration: "none" }}
          >
            Ir a Contacto
          </a>
        </section>
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
}
