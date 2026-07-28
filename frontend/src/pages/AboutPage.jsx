import React from "react";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";

export default function AboutPage({ onNavigate }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #090d16)", color: "var(--text, #ffffff)" }}>
      <PublicHeader activePath="/nosotros" onNavigate={onNavigate} />
      
      <main style={{ flex: 1, maxWidth: "1000px", margin: "0 auto", padding: "3rem 1.5rem", width: "100%" }}>
        {/* Banner principal */}
        <section style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h1 style={{ fontSize: "3rem", fontWeight: "900", background: "linear-gradient(90deg, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "1rem" }}>
            Sobre F5Manager
          </h1>
          <p style={{ fontSize: "1.25rem", color: "var(--text-muted, #94a3b8)", maxWidth: "750px", margin: "0 auto", lineHeight: "1.6" }}>
            Revolucionando la forma en que los grupos de amigos y ligas aficionadas organizan sus partidos de fútbol 5 en Latinoamérica.
          </p>
        </section>

        {/* Misión y Visión */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem", marginBottom: "4rem" }}>
          <div style={{ padding: "2rem", background: "var(--surface-1, #0f172a)", borderRadius: "16px", border: "1px solid var(--border, rgba(255, 255, 255, 0.1))" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚽</div>
            <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "0.75rem", fontWeight: "700" }}>Nuestra Misión</h2>
            <p style={{ lineHeight: "1.7", color: "var(--text-muted, #cbd5e1)" }}>
              Eliminar la fricción, los desacuerdos y la impuntualidad en los partidos de fútbol 5 amateur. Brindamos a cada organizador herramientas inteligentes de software para armar equipos matemáticamente parejos, llevar las finanzas transparentes del grupo y dar a cada jugador el protagonismo que merece con estadísticas y Fifa Cards.
            </p>
          </div>

          <div style={{ padding: "2rem", background: "var(--surface-1, #0f172a)", borderRadius: "16px", border: "1px solid var(--border, rgba(255, 255, 255, 0.1))" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏆</div>
            <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "0.75rem", fontWeight: "700" }}>Nuestra Visión</h2>
            <p style={{ lineHeight: "1.7", color: "var(--text-muted, #cbd5e1)" }}>
              Ser el ecosistema digital por excelencia para el fútbol aficionado en habla hispana, conectando a miles de jugadores, capitanes y complejos deportivos con tecnología moderna, analítica de datos e Inteligencia Artificial accesible.
            </p>
          </div>
        </section>

        {/* Historia y Origen */}
        <section style={{ marginBottom: "4rem", background: "var(--surface-1, #0f172a)", padding: "2.5rem", borderRadius: "16px", border: "1px solid var(--border, rgba(255, 255, 255, 0.1))", lineHeight: "1.8" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "1.25rem", color: "var(--text, #ffffff)", fontWeight: "800" }}>El Origen de F5Manager</h2>
          <p style={{ marginBottom: "1rem" }}>
            Todo comenzó con la misma historia que viven miles de futbolistas aficionados cada semana: grupos de WhatsApp de 30 personas donde nadie respondía a tiempo, partidos desiguales donde un equipo goleaba sin esfuerzo, confusiones con las cuotas de alquiler de la cancha y ausencias de última hora que dejaban colgados a los demás.
          </p>
          <p style={{ marginBottom: "1rem" }}>
            Un equipo de ingenieros y apasionados del fútbol en Guatemala decidió construir una solución definitiva. Así nació <strong>F5Manager</strong>: una plataforma accesible desde la web y dispositivos móviles que automatiza las tareas pesadas de organización.
          </p>
          <p>
            Hoy F5Manager ayuda a coordinar decenas de partidos semanales, registrando goles, asistencias, MVPs, control de reservas y cuotas pendientes de pago con total transparencia.
          </p>
        </section>

        {/* Valores Fundamentales */}
        <section style={{ marginBottom: "4rem" }}>
          <h2 style={{ fontSize: "2rem", textAlign: "center", marginBottom: "2.5rem", fontWeight: "800" }}>Nuestros Valores</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
            <div style={{ padding: "1.5rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <h3 style={{ color: "var(--primary, #10b981)", marginBottom: "0.5rem" }}>Transparencia Total</h3>
              <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.95rem", lineHeight: "1.6" }}>
                Todos los integrantes del grupo pueden ver el estado de la caja, quién ha pagado y qué multas están vigentes.
              </p>
            </div>
            <div style={{ padding: "1.5rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <h3 style={{ color: "var(--primary, #10b981)", marginBottom: "0.5rem" }}>Equidad y Juego Limpio</h3>
              <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.95rem", lineHeight: "1.6" }}>
                Algoritmos ponderados garantizan que cada partido tenga equipos balanceados según las habilidades de los jugadores.
              </p>
            </div>
            <div style={{ padding: "1.5rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <h3 style={{ color: "var(--primary, #10b981)", marginBottom: "0.5rem" }}>Innovación Constante</h3>
              <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.95rem", lineHeight: "1.6" }}>
                Implementamos herramientas de vanguardia como IA de asistencia de reservas y métricas en tiempo real.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: "center", padding: "3rem 2rem", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15))", borderRadius: "20px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "1rem", fontWeight: "800" }}>¿Listo para subir el nivel de tu equipo?</h2>
          <p style={{ color: "var(--text-muted, #cbd5e1)", marginBottom: "1.5rem", fontSize: "1.1rem" }}>Únete a los organizadores que ya no sufren organizando sus partidos de fútbol 5.</p>
          <a
            href="/login"
            onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate("/login") : window.location.href = "/login"; }}
            style={{ display: "inline-block", padding: "0.85rem 2rem", borderRadius: "10px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#ffffff", fontWeight: "bold", textDecoration: "none", fontSize: "1.1rem" }}
          >
            Comenzar Gratis Ahora
          </a>
        </section>
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
}
