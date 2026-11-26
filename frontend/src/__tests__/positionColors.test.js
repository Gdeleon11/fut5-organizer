import { describe, expect, it } from "vitest";
import {
  positionColor,
  positionShort,
  positionLabel,
  POSITION_COLORS,
  POSITION_NEUTRAL,
  hasDeclaredPosition,
} from "../positionColors.js";

describe("F5 Matchday Lineups — identidad visual por posición", () => {
  it("expone un color distinto y legible por cada posición", () => {
    expect(POSITION_COLORS.Goalkeeper).toBe("#eab308"); // POR amarillo
    expect(POSITION_COLORS.Defender).toBe("#3b82f6");   // DEF azul
    expect(POSITION_COLORS.Midfielder).toBe("#22c55e"); // MED verde
    expect(POSITION_COLORS.Forward).toBe("#ef4444");    // DEL rojo
    expect(POSITION_COLORS.Flexible).toBe("#a855f7");   // FLX violeta
  });

  it("los colores de distintas posiciones no colisionan", () => {
    const values = Object.values(POSITION_COLORS);
    expect(new Set(values).size).toBe(values.length);
  });

  it("devuelve neutro cuando no hay posición declarada", () => {
    expect(positionColor(undefined)).toBe(POSITION_NEUTRAL);
    expect(positionColor(null)).toBe(POSITION_NEUTRAL);
    expect(positionColor("Desconocida")).toBe(POSITION_NEUTRAL);
    expect(hasDeclaredPosition(undefined)).toBe(false);
    expect(hasDeclaredPosition("Desconocida")).toBe(false);
  });

  it("considera Flexible como sin posición declarada", () => {
    expect(hasDeclaredPosition("Flexible")).toBe(false);
    expect(positionColor("Flexible")).toBe("#a855f7"); // FLX tiene su propio color visual, pero no es declarada
  });

  it("devuelve las etiquetas cortas esperadas (POR/DEF/MED/DEL/FLX)", () => {
    expect(positionShort("Goalkeeper")).toBe("POR");
    expect(positionShort("Defender")).toBe("DEF");
    expect(positionShort("Midfielder")).toBe("MED");
    expect(positionShort("Forward")).toBe("DEL");
    expect(positionShort("Flexible")).toBe("FLX");
    expect(positionShort(undefined)).toBe("FLX");
  });

  it("devuelve etiquetas legibles acompañando al color", () => {
    expect(positionLabel("Goalkeeper")).toBe("Portero");
    expect(positionLabel("Defender")).toBe("Defensa");
    expect(positionLabel("Midfielder")).toBe("Medio");
    expect(positionLabel("Forward")).toBe("Delantero");
  });
});
