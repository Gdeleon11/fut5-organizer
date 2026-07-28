import React from "react";

export default function PublicFooter({ onNavigate }) {
  const handleLinkClick = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  return (
    <footer style={{
      background: "var(--surface-1, #0f172a)",
      borderTop: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
      padding: "3rem 1.5rem 2rem",
      color: "var(--text-muted, #94a3b8)",
      fontSize: "0.9rem",
      marginTop: "4rem"
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2.5rem" }}>
        
        {/* Columna 1: Brand & Info */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <img src="/brand/f5manager-logo.jpg" alt="F5Manager" style={{ width: "32px", height: "32px", borderRadius: "6px" }} />
            <span style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--text, #ffffff)" }}>F5Manager</span>
          </div>
          <p style={{ lineHeight: "1.6", marginBottom: "1rem" }}>
            La solución inteligente para organizadores de fútbol 5, ligas aficionadas y chamuscas en Latinoamérica.
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
            Desarrollado con ❤️ por <a href="https://innovai.gt" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #10b981)", textDecoration: "none", fontWeight: "bold" }}>InnovAI Gt</a>
          </p>
        </div>

        {/* Columna 2: Plataforma */}
        <div>
          <h4 style={{ color: "var(--text, #ffffff)", fontSize: "1rem", marginBottom: "1rem", fontWeight: "700" }}>Plataforma</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <li><a href="/" onClick={(e) => handleLinkClick(e, "/")} style={{ color: "inherit", textDecoration: "none" }}>Inicio</a></li>
            <li><a href="/caracteristicas" onClick={(e) => handleLinkClick(e, "/caracteristicas")} style={{ color: "inherit", textDecoration: "none" }}>Características</a></li>
            <li><a href="/nosotros" onClick={(e) => handleLinkClick(e, "/nosotros")} style={{ color: "inherit", textDecoration: "none" }}>Sobre Nosotros</a></li>
            <li><a href="/faq" onClick={(e) => handleLinkClick(e, "/faq")} style={{ color: "inherit", textDecoration: "none" }}>Preguntas Frecuentes</a></li>
            <li><a href="/login" onClick={(e) => handleLinkClick(e, "/login")} style={{ color: "inherit", textDecoration: "none" }}>Iniciar Sesión</a></li>
          </ul>
        </div>

        {/* Columna 3: Contenido & Guías */}
        <div>
          <h4 style={{ color: "var(--text, #ffffff)", fontSize: "1rem", marginBottom: "1rem", fontWeight: "700" }}>Publicaciones</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <li><a href="/blog" onClick={(e) => handleLinkClick(e, "/blog")} style={{ color: "inherit", textDecoration: "none" }}>Blog Principal</a></li>
            <li><a href="/blog/guia-organizar-partidos-futbol-5" onClick={(e) => handleLinkClick(e, "/blog/guia-organizar-partidos-futbol-5")} style={{ color: "inherit", textDecoration: "none" }}>Guía Organización Fútbol 5</a></li>
            <li><a href="/blog/algoritmo-ia-balancear-equipos" onClick={(e) => handleLinkClick(e, "/blog/algoritmo-ia-balancear-equipos")} style={{ color: "inherit", textDecoration: "none" }}>Balance de Equipos con IA</a></li>
            <li><a href="/blog/gestion-caja-multas-futbol-amateur" onClick={(e) => handleLinkClick(e, "/blog/gestion-caja-multas-futbol-amateur")} style={{ color: "inherit", textDecoration: "none" }}>Gestión de Finanzas y Multas</a></li>
          </ul>
        </div>

        {/* Columna 4: Legal & Contacto */}
        <div>
          <h4 style={{ color: "var(--text, #ffffff)", fontSize: "1rem", marginBottom: "1rem", fontWeight: "700" }}>Legal y Soporte</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <li><a href="/privacidad" onClick={(e) => handleLinkClick(e, "/privacidad")} style={{ color: "inherit", textDecoration: "none" }}>Política de Privacidad</a></li>
            <li><a href="/terminos" onClick={(e) => handleLinkClick(e, "/terminos")} style={{ color: "inherit", textDecoration: "none" }}>Términos y Condiciones</a></li>
            <li><a href="/contacto" onClick={(e) => handleLinkClick(e, "/contacto")} style={{ color: "inherit", textDecoration: "none" }}>Formulario de Contacto</a></li>
            <li><span style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>Email: soporte@f5manager.lat</span></li>
          </ul>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "2rem auto 0", paddingTop: "1.5rem", borderTop: "1px solid var(--border, rgba(255, 255, 255, 0.05))", textAlign: "center", fontSize: "0.85rem" }}>
        © {new Date().getFullYear()} F5Manager. lat. Todos los derechos reservados.
      </div>
    </footer>
  );
}
