import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { track, setEnabled, resetAnalyticsState } from "../analytics.js";

describe("analytics — embudo de lanzamiento (sin PII + deduplicación)", () => {
  beforeEach(() => {
    resetAnalyticsState();
    setEnabled(true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("envía el evento permitido con propiedades en lista blanca y session_id", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const sent = track("signup_start", { step: "landing", source: "landing_hero" });
    expect(sent).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.event).toBe("signup_start");
    expect(body.session_id).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    expect(body.properties).toEqual({ step: "landing", source: "landing_hero" });
  });

  it("rechaza eventos fuera de la lista blanca", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const sent = track("arbitrary_fake_payment", { amount: 49 });
    expect(sent).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("elimina claves y valores con PII de las propiedades", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    track("founders_interest_submitted", {
      email: "usuario@ejemplo.com",
      full_name: "Juan Pérez",
      phone: "5555-1234",
      city: "Ciudad de Guatemala",
      source: "usuario@ejemplo.com",
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.properties.email).toBeUndefined();
    expect(body.properties.full_name).toBeUndefined();
    expect(body.properties.phone).toBeUndefined();
    expect(body.properties.source).toBeUndefined();
    expect(body.properties.city).toBe("Ciudad de Guatemala");
  });

  it("deduplica eventos de sesión y de hito ante recargas", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    expect(track("landing_view", { page: "/" }, { dedupe: "session" })).toBe(true);
    expect(track("landing_view", { page: "/" }, { dedupe: "session" })).toBe(false);
    expect(track("group_created", { source: "app" }, { dedupe: "milestone" })).toBe(true);
    expect(track("group_created", { source: "app" }, { dedupe: "milestone" })).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("no envía cuando está deshabilitado", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    setEnabled(false);
    expect(track("landing_view")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    setEnabled(true);
  });
});
