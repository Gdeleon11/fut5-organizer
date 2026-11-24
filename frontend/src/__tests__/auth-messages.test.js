import { describe, expect, it } from "vitest";
import { authErrorMessage } from "../authMessages.js";

describe("authErrorMessage", () => {
  it.each([
    ["Invalid login credentials", "Email o contraseña incorrectos."],
    ["Email not confirmed", /no está confirmado/],
    ["User already registered", /Ya existe una cuenta/],
    ["email rate limit exceeded", /muchos intentos/],
    ["Email address \"x@y\" is invalid", /no parece válido/],
    ["Password should be at least 6 characters.", /al menos 6/],
    ["Failed to fetch", /internet/],
  ])("translates %s", (raw, expected) => {
    const out = authErrorMessage({ message: raw });
    if (expected instanceof RegExp) expect(out).toMatch(expected); else expect(out).toBe(expected);
  });

  it("never shows unknown English provider text", () => {
    expect(authErrorMessage(new Error("Some unexpected upstream failure"))).toBe("No pudimos completar el acceso. Probá de nuevo en un momento.");
  });

  it("keeps our own Spanish messages and handles empty input", () => {
    expect(authErrorMessage("La contraseña debe tener al menos 6 caracteres.")).toMatch(/contraseña/);
    expect(authErrorMessage(null)).toMatch(/Probá de nuevo/);
  });
});
