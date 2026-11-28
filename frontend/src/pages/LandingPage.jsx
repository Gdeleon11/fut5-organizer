import React, { useState, useEffect } from "react";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";
import FounderInterestForm from "../components/FounderInterestForm.jsx";
import { track } from "../analytics.js";

/**
 * F5 Manager — Landing comercial (Commercial Launch V1).
 *
 * Copy aprobado en el kit de lanzamiento (2026-11-28). Reutiliza la identidad,
 * navegación y componentes públicos existentes. No incluye afirmaciones no
 * sustentadas («plataforma #1», garantías absolutas, promesas de IA no
 * verificadas ni notificaciones automáticas que todavía no funcionan).
 */
export default function LandingPage({ onLogin, onNavigate }) {
  const [activeFaq, setActiveFaq] = useState(null);
  const [showFounderForm, setShowFounderForm] = useState(false);
  const [founderSubmitted, setFounderSubmitted] = useState(false);

  const pains = [
    {
      title: "¿Quién juega?",
      text: "Lista de confirmaciones y cupos por partido, sin perseguir respuestas entre cien mensajes de WhatsApp.",
    },
    {
      title: "¿Cómo armamos equipos parejos?",
      text: "Alineaciones basadas en posiciones y datos disponibles, sin discusiones en la cancha.",
    },
    {
      title: "¿Quién pagó y qué pasó en cancha?",
      text: "Control de cuotas y registro de resultados y estadísticas, todo en un solo lugar.",
    },
  ];

  const blocks = [
    {
      title: "Convocatorias y asistencia",
      text: "Invita a jugadores y consulta quién confirmó cada partido.",
    },
    {
      title: "Partidos semanales",
      text: "Configura una recurrencia y prepara los próximos encuentros cuando el administrador abre el grupo o pulsa «Generar ahora».",
    },
    {
      title: "Equipos equilibrados",
      text: "Genera alineaciones basadas en posiciones y valoración disponible; no asegura igualdad perfecta.",
    },
    {
      title: "Mi FIFA y estadísticas",
      text: "Tarjetas compartibles, goles, asistencias y reconocimientos registrados y validados.",
    },
    {
      title: "Campeonatos informales",
      text: "Calendario, tabla, resultados y campeón para los formatos actualmente soportados.",
    },
    {
      title: "Caja y cuotas",
      text: "Organiza quién debe y registra pagos y comprobantes; no es procesamiento de pagos en línea.",
    },
  ];

  const steps = [
    { number: "1", title: "Crea tu cuenta y tu grupo", text: "Regístrate gratis y ponele nombre a tu chamusca." },
    { number: "2", title: "Organiza un partido e invita a los jugadores", text: "Define fecha, hora y cancha; comparte el enlace por WhatsApp." },
    { number: "3", title: "Recibe confirmaciones y arma equipos", text: "Cada jugador confirma por su cuenta y se arman alineaciones parejas." },
    { number: "4", title: "Juega, registra el resultado y comparte", text: "Carga goles, asistencias y MVP; comparte el resumen con el grupo." },
  ];

  const faqs = [
    {
      q: "¿Es gratis?",
      a: "Sí. Puedes comenzar con el acceso gratuito actual. La oferta de fundadores es una propuesta opcional de acompañamiento y servicio que estamos validando.",
    },
    {
      q: "¿Tengo que instalar una aplicación?",
      a: "Funciona desde el navegador del teléfono y la computadora. No se prometen apps nativas en App Store o Play Store.",
    },
    {
      q: "¿Mis jugadores deben registrarse?",
      a: "Para acceder a las funciones de miembro y confirmar asistencia deben seguir el flujo de invitación y registro correspondiente.",
    },
    {
      q: "¿F5 envía recordatorios automáticos por WhatsApp?",
      a: "Todavía no. Puedes compartir invitaciones y contenido por WhatsApp; el envío automático de recordatorios es una función futura.",
    },
    {
      q: "¿Puedo gestionar un partido cada semana?",
      a: "Sí. El organizador configura una recurrencia semanal y el sistema prepara el horizonte de encuentros al entrar al grupo o al activar la generación manual.",
    },
  ];

  useEffect(() => {
    track("landing_view", { page: "/" }, { dedupe: "session" });
  }, []);

  const handleSignup = () => {
    track("signup_start", { source: "landing_hero" }, { dedupe: "session" });
    onLogin?.("signup");
  };

  const handleOpenFounderForm = () => {
    setFounderSubmitted(false);
    setShowFounderForm(true);
  };

  const handleFounderSubmitted = (accepted) => {
    setFounderSubmitted(Boolean(accepted));
    // Si fue descartado por honeypot (accepted=false), cerramos silenciosamente;
    // si fue envío exitoso (accepted=true), mantenemos visible la confirmación.
    if (!accepted) {
      setShowFounderForm(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #090d16)", color: "var(--text, #ffffff)" }}>
      <PublicHeader activePath="/" onNavigate={onNavigate} />

      {showFounderForm && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setShowFounderForm(false)}
            aria-hidden="true"
          />
          <FounderInterestForm
            onClose={() => setShowFounderForm(false)}
            onSubmitted={handleFounderSubmitted}
          />
        </>
      )}

      {/* Hero Section */}
      <section
        aria-label="Hero"
        style={{
          padding: "5rem 1.5rem 4rem",
          textAlign: "center",
          maxWidth: "1100px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "0.4rem 1rem",
            borderRadius: "20px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "var(--primary, #10b981)",
            fontWeight: "700",
            fontSize: "0.9rem",
            marginBottom: "1.5rem",
          }}
        >
          Fútbol 5 entre amigos, organizado de verdad.
        </div>

        <h1
          style={{
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            fontWeight: "900",
            lineHeight: "1.15",
            letterSpacing: "-0.02em",
            marginBottom: "1.5rem",
            color: "#ffffff",
          }}
        >
          Menos mensajes para organizar. Más fútbol para jugar.
        </h1>

        <p
          style={{
            fontSize: "1.25rem",
            color: "var(--text-muted, #94a3b8)",
            maxWidth: "800px",
            margin: "0 auto 2.5rem",
            lineHeight: "1.7",
          }}
        >
          Convoca a tu grupo, confirma quién juega, arma equipos equilibrados y lleva resultados,
          cuotas y estadísticas desde un solo lugar. Sin perseguir respuestas entre cien mensajes
          de WhatsApp.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "3rem" }}>
          <button
            type="button"
            onClick={handleSignup}
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
              transition: "transform 0.2s ease",
            }}
          >
            Crear mi grupo gratis
          </button>
          <button
            type="button"
            onClick={handleOpenFounderForm}
            style={{
              padding: "1rem 2rem",
              borderRadius: "12px",
              background: "transparent",
              color: "var(--text, #ffffff)",
              fontWeight: "700",
              fontSize: "1.15rem",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.25))",
              cursor: "pointer",
            }}
          >
            Quiero ser organizador fundador
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
              border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
            }}
          >
            Explorar funciones
          </a>
        </div>

        {/* Micropromesa */}
        <p
          style={{
            fontSize: "1rem",
            color: "var(--text-muted, #94a3b8)",
            maxWidth: "700px",
            margin: "0 auto",
            lineHeight: "1.6",
          }}
        >
          Comienza gratis. Comparte las invitaciones por WhatsApp. Cada jugador confirma por su cuenta.
        </p>

        {/* Tres dolores */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}
        >
          {pains.map((p, idx) => (
            <div key={idx} style={{ textAlign: "left" }}>
              <h4 style={{ fontSize: "1.1rem", fontWeight: "800", marginBottom: "0.5rem", color: "var(--text, #ffffff)" }}>{p.title}</h4>
              <p style={{ color: "var(--text-muted, #cbd5e1)", fontSize: "0.95rem", lineHeight: "1.6", margin: 0 }}>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Seis bloques funcionales */}
      <section
        style={{
          padding: "4rem 1.5rem",
          background: "rgba(255, 255, 255, 0.015)",
          borderTop: "1px solid var(--border, rgba(255, 255, 255, 0.05))",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: "800", marginBottom: "1rem", color: "var(--text, #ffffff)" }}>
              Lo que puedes hacer con F5 Manager
            </h2>
            <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "1.1rem", maxWidth: "750px", margin: "0 auto", lineHeight: "1.7" }}>
              Funcionalidades pensadas para organizadores de chamuscas semanales.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "2rem" }}>
            {blocks.map((b, idx) => (
              <div key={idx} style={{
                padding: "2rem",
                background: "var(--surface-1, #0f172a)",
                borderRadius: "16px",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
              }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "800", marginBottom: "0.75rem", color: "var(--text, #ffffff)" }}>{b.title}</h3>
                <p style={{ color: "var(--text-muted, #cbd5e1)", lineHeight: "1.6", fontSize: "0.95rem", margin: 0 }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section style={{ padding: "5rem 1.5rem", maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: "800", marginBottom: "1rem", color: "var(--text, #ffffff)" }}>
            Cómo funciona
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
              border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
            }}>
              <div style={{ fontSize: "2.5rem", fontWeight: "900", color: "var(--primary, #10b981)", opacity: 0.8, marginBottom: "0.75rem" }}>
                {step.number}
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: "800", marginBottom: "0.5rem" }}>{step.title}</h3>
              <p style={{ color: "var(--text-muted, #cbd5e1)", fontSize: "0.92rem", lineHeight: "1.6", margin: 0 }}>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Oferta de fundadores */}
      <section
        style={{
          padding: "5rem 1.5rem",
          maxWidth: "1100px",
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "750px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: "800", marginBottom: "1rem", color: "var(--text, #ffffff)" }}>
            Queremos a los primeros 10 organizadores que quieran construir el futuro de F5.
          </h2>
          <p style={{ color: "var(--text-muted, #94a3b8)", lineHeight: "1.6", marginBottom: "1.5rem", fontSize: "1.1rem" }}>
            Si organizas una chamusca semanal, prueba F5 Manager con acompañamiento durante 14 días.
            Al terminar, podrás valorar una propuesta de Organizer Pro Fundadores desde Q49 al mes.
            Participar en el piloto no obliga a contratar.
          </p>
          <button
            type="button"
            onClick={handleOpenFounderForm}
            style={{
              padding: "1rem 2.25rem",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#ffffff",
              fontWeight: "800",
              fontSize: "1.15rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Solicitar un lugar como fundador
          </button>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", marginTop: "1rem", lineHeight: "1.5" }}>
            Los servicios adicionales se coordinan personalmente; la mensajería y las notificaciones
            push automáticas aún no están disponibles.
          </p>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section
        style={{
          padding: "4rem 1.5rem",
          background: "rgba(255, 255, 255, 0.015)",
          borderTop: "1px solid var(--border, rgba(255, 255, 255, 0.05))",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "2rem", textAlign: "center", fontWeight: "800", marginBottom: "2.5rem", color: "var(--text, #ffffff)" }}>
            Preguntas frecuentes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {faqs.map((faq, idx) => (
              <div key={idx} style={{
                background: "var(--surface-1, #0f172a)",
                borderRadius: "12px",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                overflow: "hidden",
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
                    alignItems: "center",
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
            <a
              href="/faq"
              onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate("/faq") : window.location.href = "/faq"; }}
              style={{ color: "var(--primary, #10b981)", textDecoration: "none", fontWeight: "bold" }}
            >
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
