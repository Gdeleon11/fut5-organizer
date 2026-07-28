import React from "react";
import PublicHeader from "../components/PublicHeader.jsx";
import PublicFooter from "../components/PublicFooter.jsx";

const LegalLayout = ({ title, activePath, onNavigate, children }) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #090d16)", color: "var(--text, #ffffff)" }}>
    <PublicHeader activePath={activePath} onNavigate={onNavigate} />
    <main style={{ flex: 1, padding: "3rem 1.5rem", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
      <header style={{ marginBottom: "2.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "800", background: "linear-gradient(90deg, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "0.5rem" }}>
          {title}
        </h1>
        <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "1rem" }}>Última actualización: 28 de Julio, 2026</p>
      </header>
      <article style={{ lineHeight: "1.75", fontSize: "1.05rem", background: "var(--surface-1, #0f172a)", padding: "2.5rem", borderRadius: "16px", border: "1px solid var(--border, rgba(255, 255, 255, 0.1))" }}>
        {children}
      </article>
    </main>
    <PublicFooter onNavigate={onNavigate} />
  </div>
);

export function PrivacyPage({ onNavigate }) {
  return (
    <LegalLayout title="Política de Privacidad" activePath="/privacidad" onNavigate={onNavigate}>
      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>1. Información que recopilamos</h2>
      <p style={{ marginBottom: "1.5rem" }}>
        En F5Manager recopilamos únicamente la información básica indispensable para la operación y seguridad de su cuenta y la gestión de sus grupos deportivos: nombre completo, seudónimo, posición de juego preferida, número de teléfono (opcional) y dirección de correo electrónico.
      </p>
      
      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>2. Uso de los Datos</h2>
      <p style={{ marginBottom: "1.5rem" }}>
        Utilizamos la información recopilada exclusivamente para proporcionar los servicios de la plataforma: armado de equipos equilibrados mediante algoritmos de inteligencia artificial, cálculo de estadísticas y rendimiento de jugador, control de asistencia a partidos y administración de tesorería y multas. No vendemos ni comerciamos con sus datos personales a terceros.
      </p>
      
      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>3. Proveedores de Anuncios y Cookies (Google AdSense)</h2>
      <p style={{ marginBottom: "1.5rem" }}>
        F5Manager utiliza proveedores publicitarios externos, como Google AdSense, que emplean cookies de origen y de terceros para publicar anuncios basados en las visitas previas del usuario a este u otros sitios web de Internet. Los usuarios pueden gestionar o inhabilitar el uso de publicidad personalizada visitando la <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #10b981)" }}>Configuración de anuncios de Google</a> o accediendo a <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #10b981)" }}>aboutads.info</a>.
      </p>
      
      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>4. Protección y Seguridad de la Información</h2>
      <p style={{ marginBottom: "1.5rem" }}>
        Todas las conexiones e intercambios de datos en F5Manager se realizan cifrados bajo el protocolo HTTPS/SSL. La base de datos es administrada mediante la infraestructura segura de Supabase, aplicando cifrado en reposo e intercambio autenticado.
      </p>

      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>5. Sus Derechos de Acceso y Cancelación</h2>
      <p>
        Los usuarios pueden consultar, modificar o solicitar la eliminación total de sus datos personales y cuenta en cualquier momento dentro del panel de perfil de la aplicación o escribiéndonos directamente a soporte@f5manager.lat.
      </p>
    </LegalLayout>
  );
}

export function TermsPage({ onNavigate }) {
  return (
    <LegalLayout title="Términos y Condiciones de Uso" activePath="/terminos" onNavigate={onNavigate}>
      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>1. Aceptación de los Términos</h2>
      <p style={{ marginBottom: "1.5rem" }}>
        Al acceder, navegar o utilizar la plataforma F5Manager (disponible en https://f5manager.lat), el usuario declara expresamente haber leído, entendido y aceptado en su totalidad estos Términos y Condiciones. Si no se encuentra de acuerdo con alguna de las disposiciones aquí establecidas, deberá abstenerse de utilizar la plataforma.
      </p>
      
      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>2. Naturaleza del Servicio</h2>
      <p style={{ marginBottom: "1.5rem" }}>
        F5Manager es un sistema de software como servicio (SaaS) diseñado como herramienta organizativa y analítica para partidos de fútbol 5 y eventos deportivos afines. F5Manager no administra directamente las instalaciones deportivas (canchas) de terceros ni interviene como intermediario financiero bancario.
      </p>
      
      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>3. Conducta de los Usuarios y Responsabilidad de Cuentas</h2>
      <p style={{ marginBottom: "1.5rem" }}>
        Cada usuario es responsable de salvaguardar las credenciales de su cuenta. Se prohíbe el uso de la plataforma para fines ilícitos, suplantación de identidad o publicación de contenido difamatorio contra otros jugadores o administradores.
      </p>
      
      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>4. Limitación de Responsabilidad</h2>
      <p>
        F5Manager no asume responsabilidad alguna por lesiones físicas, imprevistos durante los partidos de fútbol, cancelaciones por parte de los complejos deportivos o disputas financieras internas entre los integrantes de un grupo deportivo.
      </p>
    </LegalLayout>
  );
}

export function ContactPage({ onNavigate }) {
  return (
    <LegalLayout title="Contacto y Soporte" activePath="/contacto" onNavigate={onNavigate}>
      <p style={{ marginBottom: "2rem", fontSize: "1.1rem" }}>
        ¿Tienes alguna duda sobre la plataforma, sugerencias de mejora o necesitas soporte técnico para tu grupo de fútbol 5? Estamos a tu disposición para ayudarte.
      </p>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem", marginBottom: "2.5rem" }}>
        <div style={{ padding: "1.5rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <h3 style={{ color: "var(--primary, #10b981)", marginBottom: "0.5rem" }}>📧 Correo Electrónico</h3>
          <p style={{ margin: 0, fontWeight: "bold" }}>soporte@f5manager.lat</p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.25rem" }}>Respuesta estimada en menos de 24 horas.</p>
        </div>

        <div style={{ padding: "1.5rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <h3 style={{ color: "var(--primary, #10b981)", marginBottom: "0.5rem" }}>🏢 Desarrollador</h3>
          <p style={{ margin: 0, fontWeight: "bold" }}>InnovAI Gt</p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.25rem" }}>Guatemala, Centroamérica</p>
        </div>
      </div>

      <h2 style={{ fontSize: "1.5rem", color: "var(--primary, #10b981)", marginBottom: "1rem" }}>Formulario de Mensaje Directo</h2>
      <form onSubmit={(e) => { e.preventDefault(); alert("¡Gracias por tu mensaje! Te responderemos a la brevedad."); }} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Nombre Completo</label>
          <input type="text" required placeholder="Ej. Carlos Mendoza" style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--border, #334155)", background: "#0f172a", color: "#ffffff" }} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Correo Electrónico</label>
          <input type="email" required placeholder="tucorreo@ejemplo.com" style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--border, #334155)", background: "#0f172a", color: "#ffffff" }} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Mensaje o Consulta</label>
          <textarea rows="5" required placeholder="Escribe aquí tu duda, sugerencia o reporte..." style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--border, #334155)", background: "#0f172a", color: "#ffffff" }}></textarea>
        </div>
        <button type="submit" style={{ padding: "0.85rem 1.5rem", borderRadius: "8px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#ffffff", fontWeight: "bold", border: "none", cursor: "pointer", fontSize: "1rem" }}>
          Enviar Mensaje
        </button>
      </form>
    </LegalLayout>
  );
}
