import React from "react";

export default function LandingPage({ onLogin }) {
  return (
    <div className="landing-page" style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto", color: "var(--text)" }}>
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem", color: "var(--primary)" }}>Bienvenido a F5Manager</h1>
        <p style={{ fontSize: "1.2rem", color: "var(--muted)" }}>La mejor aplicación para organizar tus partidos de fútbol 5, llevar estadísticas y gestionar a tu equipo.</p>
        <button className="primary-button" style={{ marginTop: "1.5rem", padding: "1rem 2rem", fontSize: "1.2rem" }} onClick={onLogin}>
          Entrar a la App / Iniciar Sesión
        </button>
      </header>

      <section style={{ marginBottom: "3rem" }}>
        <h2>¿Por qué usar F5Manager?</h2>
        <p>Organizar un partido de fútbol 5 amateur puede ser un dolor de cabeza. Desde conseguir la cantidad correcta de jugadores hasta asegurar que los equipos estén balanceados y todos paguen su parte de la cancha. F5Manager resuelve todo esto con herramientas inteligentes creadas específicamente para los administradores y organizadores de chamuscas y partidos amistosos.</p>
        <p>Con nuestra plataforma puedes olvidarte de los largos chats de WhatsApp. Simplemente crea el partido, invita a tus amigos y deja que el sistema haga el resto. Si faltan jugadores, puedes añadir invitados fácilmente. Además, nuestro algoritmo se asegura de crear equipos equilibrados basados en el historial, nivel y habilidades de cada jugador.</p>
      </section>

      <section style={{ marginBottom: "3rem" }}>
        <h2>Características Principales</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem", marginTop: "1.5rem" }}>
          <div style={{ padding: "1.5rem", background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Equilibrio con IA</h3>
            <p>Se acabaron los partidos desiguales. F5Manager utiliza Inteligencia Artificial para armar los equipos de forma justa y equitativa, garantizando que todos se diviertan.</p>
          </div>
          <div style={{ padding: "1.5rem", background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Estadísticas y Leaderboards</h3>
            <p>Mantén un registro de los goles, asistencias y premios MVP. Cada jugador tiene su propia "Fifa Card" que se actualiza con su rendimiento partido a partido.</p>
          </div>
          <div style={{ padding: "1.5rem", background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Gestión Financiera</h3>
            <p>Lleva el control de quién ha pagado la cuota de la cancha y quién tiene multas por llegar tarde o faltar sin avisar. Transparencia total en las finanzas del grupo.</p>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "3rem" }}>
        <h2>Testimonios de Usuarios</h2>
        <blockquote style={{ borderLeft: "4px solid var(--primary)", paddingLeft: "1rem", margin: "1rem 0", fontStyle: "italic" }}>
          "Antes pasaba horas organizando los partidos y lidiando con los que cancelaban a última hora. Con F5Manager todo es automático y los equipos siempre quedan parejos. ¡Recomendadísimo!"
          <footer style={{ marginTop: "0.5rem", fontWeight: "bold" }}>— Carlos M., Administrador de liga amateur</footer>
        </blockquote>
      </section>

      <footer style={{ textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "2rem", marginTop: "3rem" }}>
        <p>Aprende más en nuestro <a href="/blog" style={{ color: "var(--primary)" }}>Blog</a> o lee nuestras políticas.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "1rem" }}>
          <a href="/privacidad" style={{ color: "var(--muted)", textDecoration: "none" }}>Privacidad</a>
          <a href="/terminos" style={{ color: "var(--muted)", textDecoration: "none" }}>Términos</a>
          <a href="/contacto" style={{ color: "var(--muted)", textDecoration: "none" }}>Contacto</a>
        </div>
      </footer>
    </div>
  );
}
