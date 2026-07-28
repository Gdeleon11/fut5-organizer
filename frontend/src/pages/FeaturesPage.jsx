import React from "react";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";

export default function FeaturesPage({ onNavigate }) {
  const features = [
    {
      icon: "🤖",
      title: "Armado de Equipos Equilibrados con IA",
      description: "Nuestro algoritmo de Inteligencia Artificial analiza el historial de rendimiento de cada jugador, sus atributos en ataque, defensa y portería (OVR) para generar 2, 3 o 4 equipos matemáticamente parejos. Se acabaron los partidos desequilibrados.",
      details: ["Evaluación por 4 posiciones (Ataque, Medio, Defensa, Portero)", "Ajuste dinámico según rendimiento de partidos anteriores", "Simulador visual de alineaciones antes de saltar a la cancha"]
    },
    {
      icon: "🎴",
      title: "Fifa Cards y Estadísticas de Jugador",
      description: "Cada integrante del grupo cuenta con su propia tarjeta estilo Ultimate Team que refleja sus números reales: goles anotados, asistencias brindadas, premios MVP de la fecha, tasa de victorias y nivel general.",
      details: ["Tarjetas con diseño profesional compartibles", "Tabla de goleadores y asistentes de la liga o grupo", "Votación de MVP por los mismos compañeros al terminar el partido"]
    },
    {
      icon: "💰",
      title: "Gestión de Tesorería, Cobros y Multas",
      description: "Transparencia absoluta en el manejo del dinero. Registra las cuotas individuales de alquiler de la cancha, pagos por transferencia con comprobante y multas automáticas por ausencias no notificadas o llegadas tarde.",
      details: ["Subida y verificación de comprobantes de pago", "Sistema de multas parametrizable por el organizador", "Registro de ingresos y egresos del fondo común del equipo (Caja)"]
    },
    {
      icon: "📅",
      title: "Asistente de Reservas y Gestión de Canchas",
      description: "Coordinar la cancha nunca fue tan fácil. Registra los complejos deportivos de tu ciudad con mapa interactivo Leaflet, costos por hora, tipo de superficie (grama sintética, domo, madera) y notificaciones de cupo.",
      details: ["Directorio de sedes y canchas personalizable", "Confirmación de lista de asistencia en tiempo real", "Asignación de responsables de reserva por fecha"]
    },
    {
      icon: "📊",
      title: "Encuestas Pospartido y Puntuaciones",
      description: "Al finalizar cada encuentro, la app habilita una breve encuesta para calificar el desempeño de los compañeros, registrar el marcador final y asignar votos de reconocimiento deportivo.",
      details: ["Validación de resultados del partido", "Puntuación objetiva entre participantes", "Actualización automática de los rankings de la temporada"]
    },
    {
      icon: "👥",
      title: "Multi-Grupo y Roles de Administración",
      description: "Administra múltiples chamuscas o ligas independientes con la misma cuenta. Asigna roles de Administrador, Tesorero, Capitán o Jugador con permisos diferenciados.",
      details: ["Soporte para múltiples grupos y ligas", "Control de acceso por roles y etiquetas de miembro", "Creación rápida de partidos recurrentes"]
    }
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #090d16)", color: "var(--text, #ffffff)" }}>
      <PublicHeader activePath="/caracteristicas" onNavigate={onNavigate} />
      
      <main style={{ flex: 1, maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem", width: "100%" }}>
        <header style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h1 style={{ fontSize: "3rem", fontWeight: "900", background: "linear-gradient(90deg, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "1rem" }}>
            Características de F5Manager
          </h1>
          <p style={{ fontSize: "1.2rem", color: "var(--text-muted, #94a3b8)", maxWidth: "750px", margin: "0 auto", lineHeight: "1.6" }}>
            Todo lo que necesitas para llevar la administración de tus partidos de fútbol amateur al siguiente nivel.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", marginBottom: "4rem" }}>
          {features.map((f, idx) => (
            <div key={idx} style={{ padding: "2rem", background: "var(--surface-1, #0f172a)", borderRadius: "16px", border: "1px solid var(--border, rgba(255, 255, 255, 0.1))", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{f.icon}</div>
              <h2 style={{ fontSize: "1.35rem", color: "var(--text, #ffffff)", marginBottom: "0.75rem", fontWeight: "700" }}>{f.title}</h2>
              <p style={{ color: "var(--text-muted, #cbd5e1)", lineHeight: "1.6", marginBottom: "1.25rem", flex: 1 }}>{f.description}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1rem" }}>
                {f.details.map((detail, dIdx) => (
                  <li key={dIdx} style={{ fontSize: "0.88rem", color: "var(--text-muted, #94a3b8)", marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ color: "var(--primary, #10b981)", fontWeight: "bold" }}>✓</span> {detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* Resumen comparativo */}
        <section style={{ background: "var(--surface-1, #0f172a)", padding: "2.5rem", borderRadius: "20px", border: "1px solid var(--border, rgba(255, 255, 255, 0.1))", marginBottom: "4rem" }}>
          <h2 style={{ fontSize: "2rem", textAlign: "center", marginBottom: "2rem", fontWeight: "800" }}>¿Por qué F5Manager supera al grupo de WhatsApp?</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.95rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border, #334155)" }}>
                  <th style={{ padding: "1rem", color: "var(--primary, #10b981)" }}>Característica</th>
                  <th style={{ padding: "1rem", color: "#f87171" }}>Chat Tradicional de WhatsApp</th>
                  <th style={{ padding: "1rem", color: "#34d399" }}>F5Manager Platform</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>Convocatoria y Lista de Asistencia</td>
                  <td style={{ padding: "1rem", color: "#94a3b8" }}>Mensajes perdidos entre decenas de textos</td>
                  <td style={{ padding: "1rem", color: "#e2e8f0" }}>Lista interactiva con estados en tiempo real</td>
                </tr>
                <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>Armado de Equipos</td>
                  <td style={{ padding: "1rem", color: "#94a3b8" }}>A ojo o a mano, resultando en goleadas desparejas</td>
                  <td style={{ padding: "1rem", color: "#e2e8f0" }}>Algoritmo de IA ponderado por OVR de jugador</td>
                </tr>
                <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>Cobro de Cuota de Cancha</td>
                  <td style={{ padding: "1rem", color: "#94a3b8" }}>El organizador termina poniendo de su bolsa</td>
                  <td style={{ padding: "1rem", color: "#e2e8f0" }}>Control transparente de transferencias y comprobantes</td>
                </tr>
                <tr>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>Historial y Estadísticas</td>
                  <td style={{ padding: "1rem", color: "#94a3b8" }}>Inexistente</td>
                  <td style={{ padding: "1rem", color: "#e2e8f0" }}>Fifa Cards, historial de goles y tabla de líderes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
}
