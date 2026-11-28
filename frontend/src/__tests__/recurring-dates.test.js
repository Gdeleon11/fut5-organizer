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

/* ------------------------------------------------------------------ */
/* Mock de supabaseClient, almacén en memoria                         */
/* ------------------------------------------------------------------ */

const calls = [];
const stored = { recurring_matches: [], matches: [] };

function resetStore() {
  stored.recurring_matches = [];
  stored.matches = [];
  calls.length = 0;
}

function buildChain(table) {
  let _filters = [];
  let _insertPayload = null;

  const applyFilters = (rows) => {
    return rows.filter((row) => {
      return _filters.every((f) => {
        if (f.method === "eq") return row[f.args[0]] === f.args[1];
        if (f.method === "gte") return row[f.args[0]] >= f.args[1];
        return true;
      });
    });
  };

  const chain = {
    select: (...args) => {
      calls.push({ table, method: "select", args });
      _filters.push({ method: "select", args });
      return chain;
    },
    eq: (...args) => {
      calls.push({ table, method: "eq", args });
      _filters.push({ method: "eq", args });
      return chain;
    },
    gte: (...args) => {
      calls.push({ table, method: "gte", args });
      _filters.push({ method: "gte", args });
      return chain;
    },
    update: (payload) => {
      calls.push({ table, method: "update", args: [payload] });
      chain._updatePayload = payload;
      return chain;
    },
    insert: (payload) => {
      calls.push({ table, method: "insert", args: [payload] });
      chain._insertPayload = payload;
      if (table === "matches") {
        const row = { ...payload, id: `m-${Date.now()}` };
        stored.matches.push(row);
      }
      return chain;
    },
    single: () => {
      if (table === "matches") {
        const rows = applyFilters(stored.matches);
        if (rows.length > 0) return Promise.resolve({ data: rows[0], error: null });
        // Si acabamos de hacer insert, devolver la fila insertada (para createMatch)
        if (chain._insertPayload) {
          const row = { ...chain._insertPayload, id: `m-${Date.now()}` };
          stored.matches.push(row);
          return Promise.resolve({ data: row, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }
      if (table === "recurring_matches") {
        const rows = applyFilters(stored.recurring_matches);
        if (rows.length > 0) return Promise.resolve({ data: rows[0], error: null });
        if (chain._updatePayload?.id) {
          const row = stored.recurring_matches.find((r) => r.id === chain._updatePayload.id);
          return Promise.resolve({ data: row || null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then: (resolve) => {
      if (table === "recurring_matches") {
        return Promise.resolve({ data: applyFilters(stored.recurring_matches), error: null }).then(resolve);
      }
      if (table === "matches") {
        return Promise.resolve({ data: applyFilters(stored.matches), error: null }).then(resolve);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  };
  return chain;
}

vi.mock("../supabaseClient.js", () => ({
  supabase: {
    from: (table) => {
      calls.push({ table, method: "from", args: [table] });
      return buildChain(table);
    },
  },
  hasSupabaseConfig: true,
}));

import { api } from "../api.js";

beforeEach(() => {
  vi.resetAllMocks();
  resetStore();
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function partsOfISO(dateISO) {
  return guatemalaParts(new Date(`${dateISO}T12:00:00Z`));
}

const groupId = "g-recurring-test";

const makeRecurring = (overrides = {}) => ({
  id: "rec-1",
  group_id: groupId,
  title: "Chamuscón semanal",
  venue: "Cancha Futeca",
  match_time: "19:00",
  day_of_week: 3, // miércoles
  min_players: 10,
  max_players: 18,
  is_active: true,
  last_generated_date: null,
  created_at: "2026-11-26T00:00:00Z",
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* Pruebas de fecha                                                   */
/* ------------------------------------------------------------------ */

describe("Recurring Matchday — zona horaria America/Guatemala", () => {
  it("nextOccurrenceStr devuelve la fecha del próximo día de semana solicitado, en Guatemala", () => {
    const ref = new Date("2026-11-25T10:00:00Z");
    const refDate = guatemalaISODate(
      guatemalaParts(ref).year,
      guatemalaParts(ref).month,
      guatemalaParts(ref).day,
    );

    for (const targetDow of [0, 1, 2, 3, 4, 5, 6]) {
      const res = nextOccurrenceStr(targetDow, ref);
      const resParts = partsOfISO(res);
      expect(resParts.dow).toBe(targetDow);
      expect(res >= refDate).toBe(true);
      const diffDays =
        (new Date(`${res}T12:00:00Z`).getTime() -
          new Date(`${refDate}T12:00:00Z`).getTime()) /
        86400000;
      expect(diffDays).toBeGreaterThanOrEqual(0);
      expect(diffDays).toBeLessThanOrEqual(7);
    }
  });

  it("si hoy es el día solicitado, nextOccurrenceStr devuelve hoy (no la semana siguiente)", () => {
    const ref = new Date("2026-11-25T06:00:00Z");
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

  it("guatemalaParts acepta cadenas ISO sin RangeError (P0 fix)", () => {
    const parts = guatemalaParts("2026-12-10");
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(12);
    expect(parts.day).toBe(10);
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
});

/* ------------------------------------------------------------------ */
/* Pruebas de generación completa                                     */
/* ------------------------------------------------------------------ */

describe("generateUpcomingRecurringMatches — generación completa", () => {
  it("genera cuatro semanas consecutivas de una recurrencia activa", async () => {
    const rec = makeRecurring({ day_of_week: 3 }); // miércoles
    stored.recurring_matches.push(rec);

    const ref = new Date("2026-12-01T10:00:00Z"); // martes en Guatemala → próximo miércoles 2026-12-02
    const result = await api.generateUpcomingRecurringMatches(groupId, 4);

    expect(result.generated).toBe(4);
    expect(result.skipped).toBe(0);

    const inserted = stored.matches.filter((m) => m.recurring_match_id === rec.id);
    expect(inserted).toHaveLength(4);
    expect(inserted.map((m) => m.match_date).sort()).toEqual([
      "2026-12-02",
      "2026-12-09",
      "2026-12-16",
      "2026-12-23",
    ]);
    for (const m of inserted) {
      expect(partsOfISO(m.match_date).dow).toBe(3); // miércoles
    }
  });

  it("segunda generación no crea duplicados (idempotencia)", async () => {
    const rec = makeRecurring({ day_of_week: 3 });
    stored.recurring_matches.push(rec);

    const ref = new Date("2026-12-01T10:00:00Z");
    const r1 = await api.generateUpcomingRecurringMatches(groupId, 4);
    expect(r1.generated).toBe(4);

    const r2 = await api.generateUpcomingRecurringMatches(groupId, 4);
    expect(r2.generated).toBe(0);
    expect(r2.skipped).toBe(4);

    const inserted = stored.matches.filter((m) => m.recurring_match_id === rec.id);
    expect(inserted).toHaveLength(4);
  });

  it("encuentro cancelado no reaparece al regenerar", async () => {
    const rec = makeRecurring({ day_of_week: 3 });
    stored.recurring_matches.push(rec);

    const ref = new Date("2026-12-01T10:00:00Z");
    const r1 = await api.generateUpcomingRecurringMatches(groupId, 4);
    expect(r1.generated).toBe(4);

    const toCancel = stored.matches.find((m) => m.match_date === "2026-12-09");
    expect(toCancel).toBeDefined();
    toCancel.status = "canceled";

    const r2 = await api.generateUpcomingRecurringMatches(groupId, 4);
    expect(r2.generated).toBe(0);
    expect(r2.skipped).toBe(4);

    const canceled = stored.matches.find((m) => m.match_date === "2026-12-09");
    expect(canceled.status).toBe("canceled");
  });

  it("edición permitida (título) no causa duplicado al regenerar", async () => {
    const rec = makeRecurring({ day_of_week: 3 });
    stored.recurring_matches.push(rec);

    const ref = new Date("2026-12-01T10:00:00Z");
    const r1 = await api.generateUpcomingRecurringMatches(groupId, 4);
    expect(r1.generated).toBe(4);

    const toEdit = stored.matches.find((m) => m.match_date === "2026-12-02");
    toEdit.title = "Chamuscón Especial";

    const r2 = await api.generateUpcomingRecurringMatches(groupId, 4);
    expect(r2.generated).toBe(0);
    expect(r2.skipped).toBe(4);

    const edited = stored.matches.find((m) => m.match_date === "2026-12-02");
    expect(edited.title).toBe("Chamuscón Especial");
  });

  it("cambio de fecha bloqueado: updateMatch rechaza cambiar fecha de encuentro recurrente", async () => {
    const rec = makeRecurring({ day_of_week: 3 });
    stored.recurring_matches.push(rec);

    await api.generateUpcomingRecurringMatches(groupId, 4);

    // Tomar el primer partido generado (cualquiera de las 4 fechas)
    const firstMatch = stored.matches.find((m) => m.recurring_match_id === rec.id);
    expect(firstMatch).toBeDefined();
    const matchId = firstMatch.id;

    await expect(
      api.updateMatch(matchId, { match_date: "2026-12-10" }),
    ).rejects.toThrow(/No se puede cambiar la fecha de un encuentro de una serie recurrente/);
  });

  it("dos llamadas no crean duplicados (simulando admin concurrente)", async () => {
    const rec = makeRecurring({ day_of_week: 3 });
    stored.recurring_matches.push(rec);

    const ref = new Date("2026-12-01T10:00:00Z");

    const r1 = await api.generateUpcomingRecurringMatches(groupId, 4);
    expect(r1.generated).toBe(4);

    const r2 = await api.generateUpcomingRecurringMatches(groupId, 4);
    expect(r2.generated).toBe(0);
    expect(r2.skipped).toBe(4);

    const inserted = stored.matches.filter((m) => m.recurring_match_id === rec.id);
    const dates = inserted.map((m) => m.match_date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(inserted.length).toBe(4);
  });
});
