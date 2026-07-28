import React, { useState } from "react";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";

export default function LandingPage({ onLogin, onNavigate }) {
  const [activeFaq, setActiveFaq] = useState(null);

  const featuresList = [
    {
      title: "Equipos Equilibrados con IA",
      desc: "Nuestros algoritmos analizan el historial deportivo, goles, asistencias y nivel técnico (OVR) de cada jugador para armar conjuntos parejos en segundos.",
      icon: "⚡"
    },
    {
      title: "Tarjetas Fifa Card & Stats",
      desc: "Cada participante tiene su propia ficha interactiva con estadísticas en vivo: goles, asistencias, MVPs del partido y nivel por posición.",
      icon: "🎴"
    },
    {
      title: "Control de Caja & Multas",
      desc: "Transparencia total en el presupuesto del equipo. Subida de comprobantes de pago por transferencia y multas por impuntualidad o inasistencia.",
      icon: "💳"
    },
    {
      title: "Asistente de Reservas",
      desc: "Directorio de canchas locales con mapa interactivo, tipo de superficie, costos por hora y gestión de cupos de manera automática.",
      icon: "📍"
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Crea tu Grupo o Liga",
      text: "Ingresa el nombre de tu colectivo futbolístico, añade el logo o insignia y define las reglas internas de asistencia y multas."
    },
    {
      number: "02",
      title: "Convoca a tus Jugadores",
      text: "Comparte el enlace de tu grupo por WhatsApp o correo. Los jugadores confirman su asistencia con un solo toque desde su dispositivo."
    },
    {
      number: "03",
      title: "Genera los Equipos con IA",
      text: "Antes de saltar a la cancha, presiona 'Balancear Equipos'. La app evalúa las estadísticas de los asistentes para armar alineaciones parejas."
    },
    {
      number: "04",
      title: "Cierra el Partido y Registra Stats",
      text: "Ingresa el resultado final, quién anotó, dio asistencias y elige al MVP. La app recalcula la tabla de posiciones y las tarjetas de jugador."
    }
  ];

  const faqs = [
    {
      q: "¿Cómo ayuda F5Manager a resolver los desacuerdos al armar equipos?",
      a: "En lugar de discusiones subjetivas en la cancha, F5Manager utiliza un modelo matemático de optimización basado en las calificaciones y desempeño real de los jugadores, garantizando que el promedio de habilidad en cada lado sea prácticamente idéntico."
    },
    {
      q: "¿Es necesario pagar una suscripción para usar F5Manager?",
      a: "No. La versión estándar de F5Manager es gratuita y permite organizar partidos, gestionar listas de asistencia, balancear equipos con IA y llevar el control financiero de tu grupo."
    },
    {
      q: "¿Qué sucede si un jugador no está registrado en la app?",
      a: "El organizador del partido puede añadir 'Jugadores Invitados' de forma manual, asignándoles una calificación estimada para que el generador de equipos los tome en cuenta de inmediato."
    }
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #090d16)", color: "var(--text, #ffffff)" }}>
      <PublicHeader activePath="/" onNavigate={onNavigate} />

      {/* Hero Section */}
      <section style={{
        padding: "5rem 1.5rem 4rem",
        textAlign: "center",
        maxWidth: "1100px",
        margin: "0 auto",
        width: "100%"
      }}>
        <div style={{
          display: "inline-block",
          padding: "0.4rem 1rem",
          borderRadius: "20px",
          background: "rgba(16, 185, 129, 0.12)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          color: "var(--primary, #10b981)",
          fontWeight: "700",
          fontSize: "0.9rem",
          marginBottom: "1.5rem"
        }}>
          🚀 La Plataforma #1 para Organizadores de Fútbol 5 y Chamuscas
        </div>

        <h1 style={{
          fontSize: "clamp(2.5rem, 5vw, 4rem)",
          fontWeight: "900",
          lineHeight: "1.15",
          letterSpacing: "-0.02em",
          marginBottom: "1.5rem",
          background: "linear-gradient(135deg, #ffffff 30%, #94a3b8)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          Organiza tus Partidos de Fútbol 5 <br />
          <span style={{ background: "linear-gradient(90deg, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Sin Caos, Discusiones ni Impagos
          </span>
        </h1>

        <p style={{
          fontSize: "1.25rem",
          color: "var(--text-muted, #94a3b8)",
          maxWidth: "800px",
          margin: "0 auto 2.5rem",
          lineHeight: "1.7"
        }}>
          Olvida las listas interminables de WhatsApp. Con F5Manager puedes convocar a tus amigos, equilibrar equipos matemáticamente con Inteligencia Artificial, llevar el control transparente de la caja y medir las estadísticas tipo Fifa Card de cada jugador.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "3rem" }}>
          <button
            type="button"
            onClick={onLogin}
            style={{
              padding: "1rem 2.25rem",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#ffffff",
              fontWeight: "800",
              fontSize: "1.15rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(16, 185, 129, 0.3)",
              transition: "transform 0.2s ease"
            }}
          >
            Entrar a la App / Crear Grupo
          </button>

          <a
            href="/caracteristicas"
            onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate("/caracteristicas") : window.location.href = "/caracteristicas"; }}
            style={{
              padding: "1rem 2rem",
              borderRadius: "12px",
              background: "var(--surface-1, #0f172a)",
              color: "var(--text, #ffffff)",
              fontWeight: "700",
              fontSize: "1.15rem",
              textDecoration: "none",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.15))"
            }}
          >
            Explorar Funciones
          </a>
        </div>

        {/* Métricas destacadas */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
          padding: "2rem",
          background: "var(--surface-1, #0f172a)",
          borderRadius: "16px",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.1))"
        }}>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: "900", color: "var(--primary, #10b981)" }}>+10,000</div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.25rem" }}>Partidos Organizados</div>
          </div>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: "900", color: "#3b82f6" }}>99.4%</div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.25rem" }}>Precisión en Balance IA</div>
          </div>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: "900", color: "#f59e0b" }}>100%</div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.25rem" }}>Transparencia Financiera</div>
          </div>
        </div>
      </section>

      {/* Por qué F5Manager - Sección Informativa Principal */}
      <section style={{ padding: "4rem 1.5rem", background: "rgba(255, 255, 255, 0.015)", borderTop: "1px solid var(--border, rgba(255, 255, 255, 0.05))" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <h2 style={{ fontSize: "2.5rem", fontWeight: "800", marginBottom: "1rem" }}>
              ¿Por qué los organizadores eligen F5Manager?
            </h2>
            <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "1.1rem", maxWidth: "750px", margin: "0 auto", lineHeight: "1.7" }}>
              Organizar un partido de fútbol 5 (chamusca) todas las semanas requiere lidiar con ausencias de último minuto, canchas reservadas que deben pagarse por adelantado y partidos donde un equipo resulta aplastando al otro. F5Manager fue diseñado específicamente para solucionar cada uno de estos problemas.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "2rem" }}>
            {featuresList.map((item, idx) => (
              <div key={idx} style={{
                padding: "2rem",
                background: "var(--surface-1, #0f172a)",
                borderRadius: "16px",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.1))"
              }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{item.icon}</div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "700", marginBottom: "0.75rem", color: "var(--text, #ffffff)" }}>{item.title}</h3>
                <p style={{ color: "var(--text-muted, #cbd5e1)", lineHeight: "1.6", fontSize: "0.95rem" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo Funciona Paso a Paso */}
      <section style={{ padding: "5rem 1.5rem", maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h2 style={{ fontSize: "2.5rem", fontWeight: "800", marginBottom: "1rem" }}>
            Cómo Funciona en 4 Pasos Sencillos
          </h2>
          <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "1.1rem" }}>De la convocatoria al pitazo final en minutos.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "2rem" }}>
          {steps.map((step, idx) => (
            <div key={idx} style={{
              position: "relative",
              padding: "2rem 1.5rem",
              background: "var(--surface-1, #0f172a)",
              borderRadius: "16px",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.1))"
            }}>
              <div style={{ fontSize: "2.5rem", fontWeight: "900", color: "var(--primary, #10b981)", opacity: 0.8, marginBottom: "0.75rem" }}>
                {step.number}
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "0.5rem" }}>{step.title}</h3>
              <p style={{ color: "var(--text-muted, #cbd5e1)", fontSize: "0.92rem", lineHeight: "1.6" }}>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Preguntas Frecuentes en la Landing */}
      <section style={{ padding: "4rem 1.5rem", background: "rgba(255, 255, 255, 0.015)", borderTop: "1px solid var(--border, rgba(255, 255, 255, 0.05))" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "2.2rem", textAlign: "center", fontWeight: "800", marginBottom: "2.5rem" }}>
            Preguntas Frecuentes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {faqs.map((faq, idx) => (
              <div key={idx} style={{
                background: "var(--surface-1, #0f172a)",
                borderRadius: "12px",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                overflow: "hidden"
              }}>
                <button
                  type="button"
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  style={{
                    width: "100%",
                    padding: "1.25rem 1.5rem",
                    background: "transparent",
                    border: "none",
                    color: "#ffffff",
                    fontWeight: "700",
                    fontSize: "1.05rem",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ color: "var(--primary, #10b981)", fontWeight: "bold" }}>{activeFaq === idx ? "−" : "+"}</span>
                </button>
                {activeFaq === idx && (
                  <div style={{ padding: "0 1.5rem 1.25rem", color: "var(--text-muted, #cbd5e1)", lineHeight: "1.6", fontSize: "0.95rem" }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <a href="/faq" onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate("/faq") : window.location.href = "/faq"; }} style={{ color: "var(--primary, #10b981)", textDecoration: "none", fontWeight: "bold" }}>
              Ver todas las preguntas frecuentes →
            </a>
          </div>
        </div>
      </section>

      {/* Footer Público */}
      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
}
