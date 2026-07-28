import React from "react";

export default function PublicHeader({ activePath = "/", onNavigate }) {
  const navLinks = [
    { label: "Inicio", path: "/" },
    { label: "Funciones", path: "/caracteristicas" },
    { label: "Blog & Guías", path: "/blog" },
    { label: "Nosotros", path: "/nosotros" },
    { label: "Preguntas Frecuentes", path: "/faq" },
    { label: "Contacto", path: "/contacto" },
  ];

  const handleLinkClick = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  return (
    <header className="public-header" style={{
      background: "var(--surface-1, #0f172a)",
      borderBottom: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
      padding: "1rem 1.5rem",
      position: "sticky",
      top: 0,
      zIndex: 100,
      backdropFilter: "blur(10px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "1rem"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <a href="/" onClick={(e) => handleLinkClick(e, "/")} style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
          <img src="/brand/f5manager-logo.jpg" alt="F5Manager Logo" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover" }} />
          <span style={{ fontSize: "1.35rem", fontWeight: "800", background: "linear-gradient(90deg, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            F5Manager
          </span>
        </a>
      </div>

      <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        {navLinks.map((link) => (
          <a
            key={link.path}
            href={link.path}
            onClick={(e) => handleLinkClick(e, link.path)}
            style={{
              color: activePath === link.path ? "var(--primary, #10b981)" : "var(--text-muted, #94a3b8)",
              textDecoration: "none",
              fontWeight: activePath === link.path ? "700" : "500",
              fontSize: "0.95rem",
              transition: "color 0.2s ease"
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div>
        <a
          href="/login"
          onClick={(e) => handleLinkClick(e, "/login")}
          style={{
            display: "inline-block",
            padding: "0.5rem 1.25rem",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#ffffff",
            fontWeight: "700",
            textDecoration: "none",
            fontSize: "0.95rem",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
            transition: "transform 0.2s ease, boxShadow 0.2s ease"
          }}
        >
          Entrar a la App
        </a>
      </div>
    </header>
  );
}
