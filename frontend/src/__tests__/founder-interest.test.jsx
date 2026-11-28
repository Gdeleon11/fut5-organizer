import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FounderInterestForm from "../components/FounderInterestForm.jsx";
import { resetAnalyticsState } from "../analytics.js";

describe("FounderInterestForm — captación de organizadores fundadores", () => {
  let fetchMock;

  beforeEach(() => {
    resetAnalyticsState();
    fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ ok: true }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fillForm = () => {
    fireEvent.change(screen.getByLabelText(/Nombre de contacto/), {
      target: { value: "Ana Organiza" },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
      target: { value: "ana@ejemplo.com" },
    });
    fireEvent.change(screen.getByLabelText(/Ciudad/), {
      target: { value: "Ciudad de Guatemala" },
    });
    fireEvent.change(screen.getByLabelText(/¿Con qué frecuencia organizas partidos?/), {
      target: { value: "semanal" },
    });
    fireEvent.change(screen.getByLabelText(/¿Cuántos jugadores tiene tu grupo aproximado?/), {
      target: { value: "10-14" },
    });
    fireEvent.click(screen.getByLabelText(/Acepto que F5 Manager almacene mis datos/));
  };

  it("envía el lead a /api/founder-leads con consentimiento y sin campos admin", async () => {
    render(<FounderInterestForm onClose={() => {}} onSubmitted={() => {}} />);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /Solicitar lugar de fundador/ }));

    await new Promise((r) => setTimeout(r, 50));

    const leadCall = fetchMock.mock.calls.find(([url]) => url === "/api/founder-leads");
    expect(leadCall).toBeTruthy();
    const sent = JSON.parse(leadCall[1].body);
    expect(sent.contactName).toBe("Ana Organiza");
    expect(sent.email).toBe("ana@ejemplo.com");
    expect(sent.city).toBe("Ciudad de Guatemala");
    expect(sent.groupFrequency).toBe("semanal");
    expect(sent.groupSize).toBe("10-14");
    expect(sent.consent).toBe(true);
    expect(sent.status).toBeUndefined();
  });

  it("no envía sin consentimiento", async () => {
    render(<FounderInterestForm onClose={() => {}} onSubmitted={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Nombre de contacto/), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
      target: { value: "ana@ejemplo.com" },
    });
    fireEvent.change(screen.getByLabelText(/Ciudad/), {
      target: { value: "Ciudad" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar lugar de fundador/ }));

    await new Promise((r) => setTimeout(r, 50));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Debés aceptar el consentimiento para continuar./),
    ).toBeTruthy();
  });

  it("muestra confirmación tras envío exitoso y evita doble envío", async () => {
    let resolveReq;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReq = resolve;
        }),
    );

    render(<FounderInterestForm onClose={() => {}} onSubmitted={() => {}} />);
    fillForm();
    const submitBtn = screen.getByRole("button", { name: /Solicitar lugar de fundador/ });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn); // doble clic

    resolveReq({ ok: true, status: 201, json: () => Promise.resolve({ ok: true }) });
    await new Promise((r) => setTimeout(r, 50));

    const leadCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/founder-leads");
    expect(leadCalls).toHaveLength(1);
    expect(screen.getByText(/¡Gracias por sumarte!/)).toBeTruthy();
  });

  it("muestra mensaje comprensible cuando el servidor responde 429", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: "Ya recibimos una solicitud reciente con este correo." }),
    });

    render(<FounderInterestForm onClose={() => {}} onSubmitted={() => {}} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /Solicitar lugar de fundador/ }));

    await new Promise((r) => setTimeout(r, 50));

    expect(screen.getByRole("alert").textContent).toContain("Ya recibimos una solicitud reciente");
  });

  it("descarta silenciosamente si se rellena el honeypot", async () => {
    const onSubmitted = vi.fn();
    render(<FounderInterestForm onClose={() => {}} onSubmitted={onSubmitted} />);
    fillForm();
    const honeypot = document.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    fireEvent.change(honeypot, { target: { value: "https://spam.example" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar lugar de fundador/ }));

    await new Promise((r) => setTimeout(r, 50));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSubmitted).toHaveBeenCalledWith(false);
  });
});
