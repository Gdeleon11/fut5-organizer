import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FounderInterestForm from "../components/FounderInterestForm.jsx";

const insertCalls = [];
vi.mock("../supabaseClient.js", () => {
  const from = () => ({
    insert: (payload) => {
      insertCalls.push(payload);
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: "lead-1", created_at: "2026-11-28T00:00:00Z" },
              error: null,
            }),
        }),
      };
    },
  });
  return {
    supabase: { from },
    hasSupabaseConfig: true,
  };
});

import { api } from "../api.js";

beforeEach(() => {
  vi.resetAllMocks();
  insertCalls.length = 0;
});

describe("FounderInterestForm — captación de organizadores fundadores", () => {
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

  it("envía los datos del lead con consentimiento", async () => {
    render(<FounderInterestForm onClose={() => {}} onSubmitted={() => {}} />);

    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /Solicitar lugar de fundador/ }));

    await new Promise((r) => setTimeout(r, 50));

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].contact_name).toBe("Ana Organiza");
    expect(insertCalls[0].email).toBe("ana@ejemplo.com");
    expect(insertCalls[0].city).toBe("Ciudad de Guatemala");
    expect(insertCalls[0].group_frequency).toBe("semanal");
    expect(insertCalls[0].group_size).toBe("10-14");
    expect(insertCalls[0].consent).toBe(true);
    expect(insertCalls[0].status).toBe("new");
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

    expect(insertCalls).toHaveLength(0);
    expect(
      screen.getByText(/Debés aceptar el consentimiento para continuar./),
    ).toBeTruthy();
  });

  it("muestra confirmación tras envío exitoso", async () => {
    render(<FounderInterestForm onClose={() => {}} onSubmitted={() => {}} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /Solicitar lugar de fundador/ }));

    await new Promise((r) => setTimeout(r, 50));

    expect(screen.getByText(/¡Gracias por sumarte!/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Solicitar lugar de fundador/ }),
    ).toBeNull();
  });

  it("tiene el campo honeypot oculto (sistema anti-spam básico)", async () => {
    render(<FounderInterestForm onClose={() => {}} onSubmitted={() => {}} />);
    const honeypot = document.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    const style = getComputedStyle(honeypot);
    expect(style.position).toBe("absolute");
    expect(parseInt(style.left, 10)).toBeLessThan(0);
  });
});
