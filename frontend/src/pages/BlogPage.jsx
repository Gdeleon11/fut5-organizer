import React, { useState } from "react";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";
import { BLOG_POSTS } from "../blogData.js";

export default function BlogPage({ onNavigate }) {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["Todos", "Organización & Gestión", "Tecnología & IA", "Finanzas & Tesorería", "Salud & Rendimiento", "Reglamento & Táctica", "Estadísticas & Gamificación"];

  const filteredPosts = BLOG_POSTS.filter((post) => {
    const matchesCategory = selectedCategory === "Todos" || post.category === selectedCategory;
    const matchesSearch = searchQuery === "" || post.title.toLowerCase().includes(searchQuery.toLowerCase()) || post.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #090d16)", color: "var(--text, #ffffff)" }}>
      <PublicHeader activePath="/blog" onNavigate={onNavigate} />

      <main style={{ flex: 1, maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem", width: "100%" }}>
        <header style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <h1 style={{ fontSize: "3rem", fontWeight: "900", background: "linear-gradient(90deg, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "1rem" }}>
            Blog & Guías de Fútbol 5
          </h1>
          <p style={{ fontSize: "1.25rem", color: "var(--text-muted, #94a3b8)", maxWidth: "750px", margin: "0 auto", lineHeight: "1.6" }}>
            Artículos, consejos tácticos, algoritmos e historias para organizadores y jugadores de fútbol aficionado.
          </p>
        </header>

        {/* Buscador y Filtros por Categoría */}
        <section style={{ marginBottom: "3rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ maxWidth: "600px", margin: "0 auto", width: "100%" }}>
            <input
              type="text"
              placeholder="🔍 Buscar artículos por título o tema..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.85rem 1.25rem",
                borderRadius: "12px",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.15))",
                background: "var(--surface-1, #0f172a)",
                color: "#ffffff",
                fontSize: "1rem"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "0.4rem 1rem",
                  borderRadius: "20px",
                  border: selectedCategory === cat ? "1px solid var(--primary, #10b981)" : "1px solid rgba(255, 255, 255, 0.1)",
                  background: selectedCategory === cat ? "rgba(16, 185, 129, 0.15)" : "var(--surface-1, #0f172a)",
                  color: selectedCategory === cat ? "var(--primary, #10b981)" : "var(--text-muted, #94a3b8)",
                  fontWeight: selectedCategory === cat ? "700" : "500",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  transition: "all 0.2s ease"
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Grid de Artículos */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", marginBottom: "4rem" }}>
          {filteredPosts.map((post) => (
            <article
              key={post.slug}
              style={{
                background: "var(--surface-1, #0f172a)",
                borderRadius: "16px",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s ease, border-color 0.2s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ padding: "0.25rem 0.75rem", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", color: "var(--primary, #10b981)", fontSize: "0.8rem", fontWeight: "bold" }}>
                  {post.category}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>{post.readTime}</span>
              </div>

              <h2 style={{ fontSize: "1.35rem", fontWeight: "800", marginBottom: "0.75rem", lineHeight: "1.4", color: "#ffffff" }}>
                <a
                  href={`/blog/${post.slug}`}
                  onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate(`/blog/${post.slug}`) : window.location.href = `/blog/${post.slug}`; }}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {post.title}
                </a>
              </h2>

              <p style={{ color: "var(--text-muted, #cbd5e1)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "1.5rem", flex: 1 }}>
                {post.summary}
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>{post.date}</span>
                <a
                  href={`/blog/${post.slug}`}
                  onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate(`/blog/${post.slug}`) : window.location.href = `/blog/${post.slug}`; }}
                  style={{ color: "var(--primary, #10b981)", textDecoration: "none", fontWeight: "bold", fontSize: "0.9rem" }}
                >
                  Leer Artículo →
                </a>
              </div>
            </article>
          ))}
        </section>
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
}
