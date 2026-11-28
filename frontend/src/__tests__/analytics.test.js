import { describe, expect, it, vi, beforeEach } from "vitest";
import { track, setEnabled } from "../analytics.js";

describe("analytics — embudo de lanzamiento (sin PII)", () => {
  beforeEach(() => {
    setEnabled(true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Reset fetch
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("envía el evento con nombre y propiedades limpias", async () => {
    const fetch = vi.spyOn(global, "fetch");
    track("signup_start", { step: "landing" });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetch).toHaveBeenCalled();
    const body = JSON.stringify(fetch.mock.calls[0][1].body);
    expect(body).toContain("signup_start");
    expect(body).toContain("step");
  });

  it("elimina claves con PII de las propiedades", async () => {
    const fetch = vi.spyOn(global, "fetch");
    track("founders_interest_submitted", {
      email: "usuario@ejemplo.com",
      full_name: "Juan Pérez",
      phone: "5555-1234",
      city: "Ciudad de Guatemala",
    });
    await new Promise((r) => setTimeout(r, 50));
    const body = JSON.stringify(fetch.mock.calls[0][1].body);
    expect(body).not.toContain("usuario@ejemplo.com");
    expect(body).not.toContain("Juan Pérez");
    expect(body).not.toContain("5555-1234");
    expect(body).toContain("Ciudad de Guatemala");
  });

  it("no envía cuando está deshabilitado", async () => {
    const fetch = vi.spyOn(global, "fetch");
    setEnabled(false);
    track("landing_view");
    await new Promise((r) => setTimeout(r, 20));
    expect(fetch).not.toHaveBeenCalled();
    setEnabled(true);
  });
});
