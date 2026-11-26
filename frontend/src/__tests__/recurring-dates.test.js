import { describe, expect, it } from "vitest";
import {
  guatemalaParts,
  guatemalaISODate,
  nextOccurrenceStr,
  addWeeksStr,
  todayStr,
} from "../api.js";

/** Convierte una cadena ISO de fecha (YYYY-MM-DD) a partes en zona horaria de Guatemala. */
function partsOfISO(dateISO) {
  return guatemalaParts(new Date(`${dateISO}T12:00:00Z`));
}

describe("Recurring Matchday — zona horaria America/Guatemala", () => {
  it("nextOccurrenceStr devuelve la fecha del próximo día de semana solicitado, en Guatemala", () => {
    const ref = new Date("2026-11-25T10:00:00Z"); // referencia arbitraria
    const refDate = guatemalaISODate(
      guatemalaParts(ref).year,
      guatemalaParts(ref).month,
      guatemalaParts(ref).day,
    );

    for (const targetDow of [0, 1, 2, 3, 4, 5, 6]) {
      const res = nextOccurrenceStr(targetDow, ref);
      const resParts = partsOfISO(res);
      // El día de semana calculado en Guatemala coincide con el solicitado.
      expect(resParts.dow).toBe(targetDow);
      // Nunca devuelve una fecha anterior a la referencia (en calendario de Guatemala).
      expect(res >= refDate).toBe(true);
      // Es la ocurrencia inmediata: está dentro de los próximos 7 días.
      const diffDays =
        (new Date(`${res}T12:00:00Z`).getTime() -
          new Date(`${refDate}T12:00:00Z`).getTime()) /
        86400000;
      expect(diffDays).toBeGreaterThanOrEqual(0);
      expect(diffDays).toBeLessThanOrEqual(7);
    }
  });

  it("si hoy es el día solicitado, nextOccurrenceStr devuelve hoy (no la semana siguiente)", () => {
    const ref = new Date("2026-11-25T06:00:00Z"); // referencia arbitraria
    const { year, month, day, dow } = guatemalaParts(ref);
    const refDate = guatemalaISODate(year, month, day);
    const res = nextOccurrenceStr(dow, ref);
    expect(res).toBe(refDate);
  });

  it("addWeeksStr avanza semanas enteras manteniendo el calendario de Guatemala", () => {
    const base = "2026-11-25";
    const plus1 = addWeeksStr(new Date(`${base}T12:00:00Z`), 1);
    const plus4 = addWeeksStr(new Date(`${base}T12:00:00Z`), 4);
    expect(plus1).toBe("2026-12-02");
    expect(plus4).toBe("2026-12-23");
  });

  it("todayStr devuelve una fecha ISO válida en calendario de Guatemala", () => {
    const t = todayStr();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(t)).toBe(true);
    const { year, month, day } = guatemalaParts();
    expect(t).toBe(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  });
});
