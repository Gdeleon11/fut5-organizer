import React from "react";

const LegalLayout = ({ title, children }) => (
  <div className="legal-page" style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", color: "var(--text)" }}>
    <header style={{ marginBottom: "2rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "2.5rem", color: "var(--primary)", marginBottom: "0.5rem" }}>{title}</h1>
      <div style={{ marginTop: "1rem" }}>
        <a href="/" style={{ color: "var(--primary)" }}>← Volver a Inicio</a>
      </div>
    </header>
    <div style={{ lineHeight: "1.6" }}>
      {children}
    </div>
    <footer style={{ textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "2rem", marginTop: "3rem" }}>
        <p>© 2026 F5Manager. Todos los derechos reservados.</p>
    </footer>
  </div>
);

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidad">
      <h2>1. Información que recopilamos</h2>
      <p>En F5Manager recopilamos la información básica necesaria para crear su cuenta, tal como su nombre, correo electrónico y número de teléfono (opcional) para facilitar la organización de los partidos.</p>
      
      <h2 style={{ marginTop: "1.5rem" }}>2. Uso de la información</h2>
      <p>Utilizamos su información personal exclusivamente para operar y mantener el servicio de F5Manager. No vendemos ni compartimos sus datos con terceros con fines publicitarios no relacionados.</p>
      
      <h2 style={{ marginTop: "1.5rem" }}>3. Proveedores de Anuncios y AdSense</h2>
      <p>Utilizamos proveedores externos, incluido Google, que utilizan cookies para mostrar anuncios relevantes basados en sus visitas anteriores a nuestro sitio web u otros sitios web en Internet. Los usuarios pueden inhabilitar la publicidad personalizada visitando la Configuración de anuncios de Google.</p>
      
      <h2 style={{ marginTop: "1.5rem" }}>4. Seguridad</h2>
      <p>Implementamos medidas de seguridad estándar de la industria mediante Supabase para proteger su información contra acceso no autorizado, alteración, divulgación o destrucción.</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Términos y Condiciones">
      <h2>1. Aceptación de los Términos</h2>
      <p>Al acceder y utilizar F5Manager, usted acepta estar sujeto a estos términos y condiciones. Si no está de acuerdo con alguna parte de los términos, no podrá acceder al servicio.</p>
      
      <h2 style={{ marginTop: "1.5rem" }}>2. Descripción del Servicio</h2>
      <p>F5Manager es una plataforma de gestión deportiva diseñada para facilitar la organización de partidos amateur, seguimiento de estadísticas y control financiero de grupos.</p>
      
      <h2 style={{ marginTop: "1.5rem" }}>3. Cuentas de Usuario</h2>
      <p>Usted es responsable de mantener la confidencialidad de su cuenta y contraseña. Debe notificarnos inmediatamente de cualquier violación de seguridad o uso no autorizado de su cuenta.</p>
      
      <h2 style={{ marginTop: "1.5rem" }}>4. Limitación de Responsabilidad</h2>
      <p>F5Manager no se hace responsable por lesiones, disputas financieras entre jugadores, o cancelaciones de instalaciones deportivas. La plataforma es únicamente una herramienta de gestión.</p>
    </LegalLayout>
  );
}

export function ContactPage() {
  return (
    <LegalLayout title="Contacto">
      <h2>Póngase en contacto con nosotros</h2>
      <p>Si tiene alguna pregunta sobre F5Manager, necesita soporte técnico, o desea reportar un problema, por favor contáctenos a través de los siguientes medios:</p>
      
      <ul style={{ marginTop: "1.5rem", listStyleType: "none", padding: 0 }}>
        <li style={{ marginBottom: "0.5rem" }}><strong>Correo Electrónico:</strong> soporte@f5manager.lat</li>
        <li style={{ marginBottom: "0.5rem" }}><strong>Teléfono:</strong> +502 5555-0000</li>
        <li style={{ marginBottom: "0.5rem" }}><strong>Dirección:</strong> Ciudad de Guatemala, Guatemala</li>
      </ul>
      
      <p style={{ marginTop: "2rem" }}>Nuestro equipo responderá a sus consultas en un plazo de 24 a 48 horas hábiles.</p>
    </LegalLayout>
  );
}
