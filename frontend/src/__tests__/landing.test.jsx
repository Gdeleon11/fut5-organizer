import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LandingPage from "../pages/LandingPage.jsx";

describe("LandingPage — comercial V1", () => {
  const onLogin = vi.fn();
  const onNavigate = vi.fn();

  beforeEach(() => {
    onLogin.mockClear();
    onNavigate.mockClear();
  });

  it("renderiza el hero con el copy aprobado y sin afirmaciones no sustentadas", () => {
    render(<LandingPage onLogin={onLogin} onNavigate={onNavigate} />);

    expect(screen.getByText(/Fútbol 5 entre amigos, organizado de verdad./)).toBeTruthy();
    expect(
      screen.getByText(/Menos mensajes para organizar\. Más fútbol para jugar\./),
    ).toBeTruthy();

    // No afirmaciones no permitidas del kit de lanzamiento
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/plataforma\s*#\s*1/i);
    expect(html).not.toMatch(/número\s*#\s*1/i);
    expect(html).not.toMatch(/garantiz/i);
    expect(html).not.toMatch(/IA generativa/i);
  });

  it("el CTA principal conecta con el flujo de registro (signup)", () => {
    render(<LandingPage onLogin={onLogin} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: /Crear mi grupo gratis/ }));
    expect(onLogin).toHaveBeenCalledWith("signup");
  });

  it("el CTA fundador abre el formulario de interés", () => {
    render(<LandingPage onLogin={onLogin} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: /Quiero ser organizador fundador/ }));

    expect(
      screen.getByRole("heading", { name: /Solicitar un lugar como fundador/ }),
    ).toBeTruthy();
  });

  it("muestre bloques funcionales y pasos sin promesas absolutas", () => {
    render(<LandingPage onLogin={onLogin} onNavigate={onNavigate} />);

    expect(screen.getByText(/Convocatorias y asistencia/)).toBeTruthy();
    expect(screen.getByText(/Partidos semanales/)).toBeTruthy();
    expect(screen.getByText(/Equipos equilibrados/)).toBeTruthy();
    expect(screen.getByText(/Mi FIFA y estadísticas/)).toBeTruthy();
    expect(screen.getByText(/Campeonatos informales/)).toBeTruthy();
    expect(screen.getByText(/Caja y cuotas/)).toBeTruthy();
  });

  it("muestra la oferta de fundadores", () => {
    render(<LandingPage onLogin={onLogin} onNavigate={onNavigate} />);

    expect(screen.getByText(/primeros 10 organizadores/)).toBeTruthy();
    expect(screen.getByText(/Q49/)).toBeTruthy();
  });

  it("muestra preguntas frecuentes aprobadas", () => {
    render(<LandingPage onLogin={onLogin} onNavigate={onNavigate} />);

    expect(screen.getByText(/¿Es gratis?/)).toBeTruthy();
    expect(screen.getByText(/¿F5 envía recordatorios automáticos por WhatsApp\?/)).toBeTruthy();
  });
});
