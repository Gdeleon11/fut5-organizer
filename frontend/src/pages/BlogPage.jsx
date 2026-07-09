import React from "react";

export default function BlogPage() {
  return (
    <div className="blog-page" style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", color: "var(--text)" }}>
      <header style={{ marginBottom: "3rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", color: "var(--primary)", marginBottom: "0.5rem" }}>Blog de F5Manager</h1>
        <p style={{ color: "var(--muted)" }}>Consejos, tácticas y guías para organizar y jugar el mejor fútbol 5.</p>
        <div style={{ marginTop: "1rem" }}>
          <a href="/" style={{ color: "var(--primary)" }}>← Volver a Inicio</a>
        </div>
      </header>

      <article style={{ marginBottom: "4rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>5 Consejos para Organizar tu Partido de Fútbol 5</h2>
        <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>Publicado el 1 de Julio, 2026</p>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          Organizar un partido de fútbol 5 (o "chamusca") todas las semanas puede parecer una tarea sencilla, pero quienes lo hacemos sabemos que requiere paciencia. Desde encontrar la cancha adecuada hasta asegurarse de que todos lleguen a tiempo.
        </p>
        <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>1. Establece reglas claras desde el principio</h3>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          Es vital que todos los jugadores conozcan las reglas del grupo. ¿Qué pasa si alguien cancela a última hora? En F5Manager recomendamos implementar un sistema de multas simbólicas para evitar ausencias injustificadas que arruinen el balance de los equipos.
        </p>
        <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>2. Usa herramientas tecnológicas</h3>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          Olvídate de las listas de WhatsApp que se pierden entre cientos de mensajes. Utilizar aplicaciones como F5Manager permite a cada jugador confirmar su asistencia de manera individual, dejando un registro claro de quiénes jugarán.
        </p>
        <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>3. Cobra por adelantado o establece un responsable</h3>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          El problema financiero suele ser el mayor dolor de cabeza. Designa a un "Tesorero" del grupo o exige que la cuota de la cancha se pague por transferencia antes del pitazo inicial.
        </p>
      </article>

      <article style={{ marginBottom: "4rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Cómo Balancear Equipos de Fútbol Amateur</h2>
        <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>Publicado el 15 de Junio, 2026</p>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          No hay nada peor que un partido desequilibrado donde un equipo gana 15 a 0. La diversión se pierde y la motivación para el próximo partido disminuye. El secreto está en la distribución de roles.
        </p>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          Primero, identifica a tus "jugadores franquicia" o estrellas. Asegúrate de que no jueguen todos juntos. Segundo, revisa las posiciones. Un equipo lleno de delanteros sin defensas está destinado al fracaso.
        </p>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          La Inteligencia Artificial de F5Manager evalúa el OVR (Overall Rating) de cada jugador, considerando sus habilidades en ataque, defensa y portería, para generar los equipos más justos matemáticamente posibles.
        </p>
      </article>

      <article style={{ marginBottom: "4rem" }}>
        <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>La Importancia del Tercer Tiempo</h2>
        <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>Publicado el 2 de Mayo, 2026</p>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          El fútbol amateur no se trata solo de patear un balón; se trata de la comunidad. El "tercer tiempo", ese espacio de convivencia después del partido, es fundamental para fortalecer los lazos del grupo.
        </p>
        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          Utiliza los excedentes de las cuotas o las multas recaudadas (la "Caja" del grupo) para comprar bebidas o snacks al final del mes. Esto no solo incentiva a los jugadores a ser puntuales, sino que premia la constancia del equipo.
        </p>
      </article>

      <footer style={{ textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "2rem", marginTop: "3rem" }}>
        <p>© 2026 F5Manager. Todos los derechos reservados.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "1rem" }}>
          <a href="/privacidad" style={{ color: "var(--muted)", textDecoration: "none" }}>Privacidad</a>
          <a href="/terminos" style={{ color: "var(--muted)", textDecoration: "none" }}>Términos</a>
          <a href="/contacto" style={{ color: "var(--muted)", textDecoration: "none" }}>Contacto</a>
        </div>
      </footer>
    </div>
  );
}
