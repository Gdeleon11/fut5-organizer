import fs from "fs";
import path from "path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  guatemalaParts,
  guatemalaISODate,
  nextOccurrenceStr,
  addWeeksStr,
  todayStr,
} from "../api.js";

const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  update: vi.fn().mockImplementation(function (payload) {
    this._lastPayload = payload;
    return this;
  }),
  single: vi.fn().mockImplementation(function () {
    const base = {
      id: "m-recurring",
      recurring_match_id: "rec-1",
      match_date: "2026-12-03",
      title: "Jueves F5",
    };
    const merged = this._lastPayload ? { ...base, ...this._lastPayload } : base;
    this._lastPayload = undefined;
    return Promise.resolve({ data: merged, error: null });
  }),
};

vi.mock("../supabaseClient.js", () => ({
  supabase: { from: () => mockChain },
  hasSupabaseConfig: true,
}));

import { api } from "../api.js";

beforeEach(() => {
  vi.resetAllMocks();
  mockChain.select.mockReturnThis();
  mockChain.eq.mockReturnThis();
  mockChain.update.mockImplementation(function (payload) {
    this._lastPayload = payload;
    return this;
  });
  mockChain.single.mockImplementation(function () {
    const base = {
      id: "m-recurring",
      recurring_match_id: "rec-1",
      match_date: "2026-12-03",
      title: "Jueves F5",
    };
    const merged = this._lastPayload ? { ...base, ...this._lastPayload } : base;
    this._lastPayload = undefined;
    return Promise.resolve({ data: merged, error: null });
  });
});

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

  it("la migración aditiva de recurrencias define recurring_match_id con ON DELETE SET NULL e índice único parcial", () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "../supabase/migrations/20261126183000_recurring_matches_idempotency.sql"),
      "utf8",
    );
    expect(sql).toMatch(/\bBEGIN;/);
    expect(sql).toMatch(/\bCOMMIT;/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS recurring_match_id uuid/i);
    expect(sql).toMatch(/ON DELETE SET NULL/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS matches_recurring_unique_date_idx/i);
    expect(sql).toMatch(/WHERE recurring_match_id IS NOT NULL/i);
  });

  describe("updateMatch — restricción de cambio de fecha en encuentros recurrentes", () => {
    it("rechaza cambiar match_date de un encuentro vinculado a una recurrencia", async () => {
      await expect(
        api.updateMatch("m-recurring", { match_date: "2026-12-10" }),
      ).rejects.toThrow(/No se puede cambiar la fecha de un encuentro de una serie recurrente/);
    });

    it("permite editar otros campos (título) de un encuentro recurrente sin cambiar la fecha", async () => {
      const result = await api.updateMatch("m-recurring", { title: "Jueves F5 — Editado" });
      expect(result.title).toBe("Jueves F5 — Editado");
      expect(result.match_date).toBe("2026-12-03");
    });

    it("no rechaza cuando se envía la misma fecha ya guardada (no es un cambio)", async () => {
      const result = await api.updateMatch("m-recurring", { match_date: "2026-12-03" });
      expect(result.match_date).toBe("2026-12-03");
    });
  });
});
