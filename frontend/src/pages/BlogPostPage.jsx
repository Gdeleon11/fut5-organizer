import React from "react";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";
import { BLOG_POSTS } from "../blogData.js";

export default function BlogPostPage({ slug, onNavigate }) {
  const post = BLOG_POSTS.find((p) => p.slug === slug) || BLOG_POSTS[0];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #090d16)", color: "var(--text, #ffffff)" }}>
      <PublicHeader activePath="/blog" onNavigate={onNavigate} />

      <main style={{ flex: 1, maxWidth: "850px", margin: "0 auto", padding: "3rem 1.5rem", width: "100%" }}>
        <nav style={{ marginBottom: "2rem" }}>
          <a
            href="/blog"
            onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate("/blog") : window.location.href = "/blog"; }}
            style={{ color: "var(--primary, #10b981)", textDecoration: "none", fontWeight: "bold", fontSize: "0.95rem" }}
          >
            ← Volver al Blog de F5Manager
          </a>
        </nav>

        <header style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span style={{ padding: "0.3rem 0.8rem", borderRadius: "20px", background: "rgba(16, 185, 129, 0.15)", color: "var(--primary, #10b981)", fontSize: "0.85rem", fontWeight: "bold" }}>
              {post.category}
            </span>
            <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.85rem" }}>{post.date}</span>
            <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.85rem" }}>• {post.readTime}</span>
          </div>

          <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: "900", lineHeight: "1.25", color: "var(--text, #ffffff)", marginBottom: "1.25rem" }}>
            {post.title}
          </h1>

          <p style={{ fontSize: "1.2rem", color: "var(--text-muted, #cbd5e1)", lineHeight: "1.6", fontStyle: "italic", borderLeft: "4px solid var(--primary, #10b981)", paddingLeft: "1rem", margin: 0 }}>
            {post.summary}
          </p>
        </header>

        <article style={{
          background: "var(--surface-1, #0f172a)",
          padding: "2.5rem",
          borderRadius: "20px",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
          lineHeight: "1.8",
          fontSize: "1.08rem",
          color: "var(--text, #e2e8f0)"
        }}>
          {post.content.split("\n\n").map((paragraph, idx) => {
            if (paragraph.startsWith("### ")) {
              return <h3 key={idx} style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginTop: "2rem", marginBottom: "0.75rem", fontWeight: "700" }}>{paragraph.replace("### ", "")}</h3>;
            }
            if (paragraph.startsWith("## ")) {
              return <h2 key={idx} style={{ fontSize: "1.75rem", color: "#ffffff", marginTop: "2.25rem", marginBottom: "1rem", fontWeight: "800" }}>{paragraph.replace("## ", "")}</h2>;
            }
            if (paragraph.startsWith("---")) {
              return <hr key={idx} style={{ border: 0, borderTop: "1px solid rgba(255, 255, 255, 0.1)", margin: "2rem 0" }} />;
            }
            if (paragraph.startsWith("- ")) {
              const items = paragraph.split("\n- ");
              return (
                <ul key={idx} style={{ paddingLeft: "1.5rem", marginBottom: "1.5rem" }}>
                  {items.map((it, iIdx) => (
                    <li key={iIdx} style={{ marginBottom: "0.5rem" }}>
                      {it.replace("- ", "")}
                    </li>
                  ))}
                </ul>
              );
            }
            return <p key={idx} style={{ marginBottom: "1.5rem" }}>{paragraph}</p>;
          })}
        </article>

        {/* Banner CTA al final del artículo */}
        <section style={{ marginTop: "3rem", padding: "2.5rem", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(59, 130, 246, 0.12))", borderRadius: "16px", border: "1px solid rgba(16, 185, 129, 0.25)", textAlign: "center" }}>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "0.75rem" }}>¿Quieres aplicar esto en tus partidos?</h3>
          <p style={{ color: "var(--text-muted, #cbd5e1)", marginBottom: "1.5rem" }}>Crea tu grupo gratis en F5Manager y automatiza la organización de tu equipo de fútbol 5 hoy mismo.</p>
          <a
            href="/login"
            onClick={(e) => { e.preventDefault(); onNavigate ? onNavigate("/login") : window.location.href = "/login"; }}
            style={{ display: "inline-block", padding: "0.75rem 1.75rem", borderRadius: "8px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#ffffff", fontWeight: "bold", textDecoration: "none" }}
          >
            Comenzar Gratis
          </a>
        </section>
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
}
