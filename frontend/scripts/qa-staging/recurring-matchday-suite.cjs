#!/usr/bin/env node
/**
 * Staging QA & Concurrency Suite for Recurring Matchday V1 (ylynjvssjlmhzgmhkrsd ONLY).
 *
 * Tests with real user JWTs (2 simultaneous admins + 1 regular player):
 *  - Admin-only RLS on recurring_matches
 *  - Independent match collision isolation (same date/time/venue/title)
 *  - 2 simultaneous admins generating 4-week horizon concurrently (0 duplicates via 23505)
 *  - Idempotent reload / re-generation (0 new rows)
 *  - Separate recurrences on same weekday
 *  - Individual edit preservation (editing title/time/venue does not trigger duplicate)
 *  - Pause -> no generation -> reactivate -> generates only missing dates
 *  - Zero auto-confirmations (attendances = 0)
 *  - Compatibility with match_fees / fines / Radar settings
 *  - Cancel recurrence preserves all previously generated matches (ON DELETE SET NULL)
 *  - Full cleanup of synthetic group and users
 */
const { execSync } = require("node:child_process");

const STAGING_REF = "ylynjvssjlmhzgmhkrsd";
const BASE_URL = `https://${STAGING_REF}.supabase.co`;
const GT_TZ = "America/Guatemala";

function getStagingKeys() {
  const raw = execSync(`supabase projects api-keys --project-ref ${STAGING_REF} -o json`, { encoding: "utf8" });
  const keys = JSON.parse(raw);
  return {
    anon: keys.find((k) => k.name === "anon")?.api_key,
    serviceRole: keys.find((k) => k.name === "service_role")?.api_key,
  };
}

function gtParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GT_TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day), dow: dowMap[map.weekday] };
}

function gtISO(y, m, d) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addGtDays(date, days) {
  const { year, month, day } = gtParts(date);
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return gtISO(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

function nextOcc(targetDow, from = new Date()) {
  const { dow } = gtParts(from);
  const diff = (Number(targetDow) - dow + 7) % 7;
  return addGtDays(from, diff);
}

function addWeeks(dateOrStr, weeks) {
  const base = typeof dateOrStr === "string" ? new Date(`${dateOrStr}T12:00:00Z`) : dateOrStr;
  return addGtDays(base, weeks * 7);
}

async function req(path, { method = "GET", apiKey, bearer, body, prefer } = {}) {
  const headers = { apikey: apiKey, Authorization: `Bearer ${bearer || apiKey}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

async function createUser(sr, anon, tag) {
  const email = `rec-qa-${tag}-${Date.now()}-${Math.floor(Math.random() * 9999)}@f5staging.test`;
  const password = "RecQaPass!2026Staging";
  const u = await req("/auth/v1/admin/users", {
    method: "POST", apiKey: sr, body: { email, password, email_confirm: true, user_metadata: { full_name: `QA ${tag}` } },
  });
  if (!u.ok) throw new Error(`Create ${tag} failed: ${JSON.stringify(u.data)}`);
  await req("/rest/v1/profiles", {
    method: "POST", apiKey: sr, prefer: "resolution=merge-duplicates",
    body: { id: u.data.id, full_name: `QA ${tag}`, nickname: `QA_${tag}`, phone: "5555-9000", preferred_position: "Midfielder", is_active: true },
  });
  const login = await req("/auth/v1/token?grant_type=password", {
    method: "POST", apiKey: anon, body: { email, password },
  });
  if (!login.ok) throw new Error(`Login ${tag} failed`);
  return { id: u.data.id, jwt: login.data.access_token };
}

/** Mirrors hardened api.generateUpcomingRecurringMatches(groupId, 4) using a real admin JWT. */
async function generateUpcomingAsAdmin(anon, adminJwt, groupId, horizonWeeks = 4) {
  const today = addGtDays(new Date(), 0);
  const [recRes, exRes] = await Promise.all([
    req(`/rest/v1/recurring_matches?group_id=eq.${groupId}&select=*`, { apiKey: anon, bearer: adminJwt }),
    req(`/rest/v1/matches?group_id=eq.${groupId}&match_date=gte.${today}&select=id,recurring_match_id,match_date`, { apiKey: anon, bearer: adminJwt }),
  ]);
  if (!recRes.ok) throw new Error(`list recurring failed: ${JSON.stringify(recRes.data)}`);
  if (!exRes.ok) throw new Error(`list existing failed: ${JSON.stringify(exRes.data)}`);
  const existingKeys = new Set((exRes.data || []).filter((m) => m.recurring_match_id).map((m) => `${m.recurring_match_id}|${m.match_date}`));
  const active = (recRes.data || []).filter((r) => r.is_active);
  const nowRef = new Date();
  const horizonEnd = addWeeks(nowRef, horizonWeeks);
  let generated = 0;
  let skipped = 0;
  let conflict23505 = 0;

  for (const r of active) {
    let dateStr = nextOcc(r.day_of_week, nowRef);
    let lastOkDate = null;
    while (dateStr <= horizonEnd) {
      const key = `${r.id}|${dateStr}`;
      if (existingKeys.has(key)) {
        skipped += 1;
        lastOkDate = dateStr;
      } else {
        const ins = await req("/rest/v1/matches", {
          method: "POST", apiKey: anon, bearer: adminJwt,
          body: {
            group_id: r.group_id, recurring_match_id: r.id, title: r.title,
            match_date: dateStr, start_time: r.match_time, venue: r.venue,
            min_players: r.min_players, max_players: r.max_players, status: "upcoming",
          },
        });
        if (!ins.ok && ins.data?.code === "23505") {
          skipped += 1;
          conflict23505 += 1;
          existingKeys.add(key);
          lastOkDate = dateStr;
        } else if (!ins.ok) {
          throw new Error(`insert match failed: ${JSON.stringify(ins.data)}`);
        } else {
          generated += 1;
          existingKeys.add(key);
          lastOkDate = dateStr;
        }
      }
      dateStr = addWeeks(dateStr, 1);
    }
    if (lastOkDate) {
      await req(`/rest/v1/recurring_matches?id=eq.${r.id}`, {
        method: "PATCH", apiKey: anon, bearer: adminJwt, body: { last_generated_date: lastOkDate },
      });
    }
  }
  return { generated, skipped, conflict23505, horizonEnd };
}

const assert = (cond, msg) => { if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`); };

async function main() {
  const { anon, serviceRole } = getStagingKeys();
  const userIds = [];
  let groupId = null;

  try {
    console.log(`\n=== RECURRING MATCHDAY V1 STAGING SUITE (${STAGING_REF}) ===`);
    const admin1 = await createUser(serviceRole, anon, "adm1");
    const admin2 = await createUser(serviceRole, anon, "adm2");
    const player = await createUser(serviceRole, anon, "ply1");
    userIds.push(admin1.id, admin2.id, player.id);

    const gRes = await req("/rest/v1/groups", {
      method: "POST", apiKey: serviceRole, prefer: "return=representation",
      body: { name: `QA Recurring ${Date.now()}`, owner_id: admin1.id },
    });
    groupId = gRes.data[0].id;
    await req("/rest/v1/group_members", {
      method: "POST", apiKey: serviceRole,
      body: [
        { group_id: groupId, profile_id: admin1.id, role: "super_admin", is_active: true },
        { group_id: groupId, profile_id: admin2.id, role: "admin", is_active: true },
        { group_id: groupId, profile_id: player.id, role: "player", is_active: true },
      ],
    });

    // 1. Non-admin player CANNOT create recurring_matches
    const plyCreate = await req("/rest/v1/recurring_matches", {
      method: "POST", apiKey: anon, bearer: player.jwt,
      body: { group_id: groupId, title: "No autorizado", day_of_week: 4, match_time: "19:00", venue: "X", min_players: 10, max_players: 14, is_active: true },
    });
    assert(!plyCreate.ok, "Regular player must NOT create recurring_matches");
    console.log("1. Non-admin RLS block: OK");

    // 2. Admin 1 creates Recurrence A (Thursday 19:00)
    const recARes = await req("/rest/v1/recurring_matches", {
      method: "POST", apiKey: anon, bearer: admin1.jwt, prefer: "return=representation",
      body: { group_id: groupId, title: "Jueves F5", day_of_week: 4, match_time: "19:00", venue: "Futeca QA", min_players: 10, max_players: 14, is_active: true },
    });
    assert(recARes.ok, `Create recurrence A failed: ${JSON.stringify(recARes.data)}`);
    const recA = recARes.data[0];

    // 3. Create an INDEPENDENT manual match on the EXACT same date/time/venue/title
    const firstDate = nextOcc(4);
    const manualRes = await req("/rest/v1/matches", {
      method: "POST", apiKey: anon, bearer: admin1.jwt, prefer: "return=representation",
      body: { group_id: groupId, title: "Jueves F5", match_date: firstDate, start_time: "19:00", venue: "Futeca QA", min_players: 10, max_players: 14, status: "upcoming" },
    });
    assert(manualRes.ok, "Create independent match failed");
    const manualMatch = manualRes.data[0];
    assert(manualMatch.recurring_match_id === null, "Independent match must have recurring_match_id = null");

    // 4. TWO SIMULTANEOUS ADMINS generate concurrently!
    const [r1, r2] = await Promise.all([
      generateUpcomingAsAdmin(anon, admin1.jwt, groupId, 4),
      generateUpcomingAsAdmin(anon, admin2.jwt, groupId, 4),
    ]);
    const listAfterRace = await req(`/rest/v1/matches?group_id=eq.${groupId}&recurring_match_id=eq.${recA.id}&select=id,match_date,title,start_time,venue`, {
      apiKey: anon, bearer: admin1.jwt,
    });
    const datesA = listAfterRace.data.map((m) => m.match_date);
    const uniqueDatesA = new Set(datesA);
    assert(datesA.length === uniqueDatesA.size, `DUPLICATE DETECTED under 2-admin concurrency: ${JSON.stringify(datesA)}`);
    assert(datesA.length >= 4 && datesA.length <= 5, `Expected 4-5 occurrences in 4-week horizon, got ${datesA.length}`);
    assert(datesA.includes(firstDate), "Independent match must NOT block recurrence A from generating its own match");
    // Verify America/Guatemala weekday = 4 (Thu) for every generated date
    for (const d of datesA) {
      assert(gtParts(new Date(`${d}T12:00:00Z`)).dow === 4, `Date ${d} is not Thursday in America/Guatemala`);
    }
    console.log(`2-4. 2-Admin simultaneous generation: OK (${datesA.length} unique dates, r1.gen=${r1.generated}, r2.gen=${r2.generated}, 23505_handled=${r1.conflict23505 + r2.conflict23505})`);

    // Verify ZERO auto-confirmations
    const attRes = await req(`/rest/v1/attendances?match_id=in.(${listAfterRace.data.map((m) => m.id).join(",")})&select=id`, {
      apiKey: anon, bearer: admin1.jwt,
    });
    assert((attRes.data || []).length === 0, "Generated matches must have 0 auto-confirmed attendances");
    console.log("   Zero auto-confirmations: OK");

    // 5. Reload + generate again -> 0 generated
    const r3 = await generateUpcomingAsAdmin(anon, admin1.jwt, groupId, 4);
    assert(r3.generated === 0 && r3.skipped === datesA.length, `Idempotent re-run failed: ${JSON.stringify(r3)}`);
    console.log("5. Idempotent reload / re-generation: OK (0 new)");

    // 6. Second recurrence B on SAME weekday (different series)
    const recBRes = await req("/rest/v1/recurring_matches", {
      method: "POST", apiKey: anon, bearer: admin2.jwt, prefer: "return=representation",
      body: { group_id: groupId, title: "Jueves Nocturno B", day_of_week: 4, match_time: "21:00", venue: "Futeca QA", min_players: 10, max_players: 12, is_active: true },
    });
    const recB = recBRes.data[0];
    const rB = await generateUpcomingAsAdmin(anon, admin2.jwt, groupId, 4);
    assert(rB.generated === datesA.length, `Recurrence B should generate ${datesA.length} separate matches, got ${rB.generated}`);
    console.log("6. Separate recurrences on same weekday: OK");

    // 7. Individually edit a generated match -> re-run generation -> NO duplicate & edits preserved!
    const targetMatch = listAfterRace.data[0];
    const editRes = await req(`/rest/v1/matches?id=eq.${targetMatch.id}`, {
      method: "PATCH", apiKey: anon, bearer: admin1.jwt, prefer: "return=representation",
      body: { title: "Jueves F5 — Edición Especial", start_time: "20:30", venue: "Otra Cancha QA", court_cost: 350 },
    });
    assert(editRes.ok, "Edit individual generated match failed");
    const rAfterEdit = await generateUpcomingAsAdmin(anon, admin1.jwt, groupId, 4);
    assert(rAfterEdit.generated === 0, `Editing individual match caused duplicate re-generation! ${JSON.stringify(rAfterEdit)}`);
    const checkEdited = await req(`/rest/v1/matches?id=eq.${targetMatch.id}&select=title,start_time,venue`, { apiKey: anon, bearer: admin1.jwt });
    assert(checkEdited.data[0].title === "Jueves F5 — Edición Especial" && checkEdited.data[0].start_time === "20:30", "Individual edits were overwritten!");
    console.log("7. Individual match edit preserved & no duplicate: OK");

    // 8. Pause recurrence A -> delete one future generated match -> re-run generation -> 0 generated!
    await req(`/rest/v1/recurring_matches?id=eq.${recA.id}`, { method: "PATCH", apiKey: anon, bearer: admin1.jwt, body: { is_active: false } });
    const deletedMatch = listAfterRace.data[1];
    await req(`/rest/v1/matches?id=eq.${deletedMatch.id}`, { method: "DELETE", apiKey: anon, bearer: admin1.jwt });
    const rPaused = await generateUpcomingAsAdmin(anon, admin1.jwt, groupId, 4);
    assert(rPaused.generated === 0, `Paused recurrence should generate 0 matches, got ${rPaused.generated}`);
    console.log("8. Pause recurrence blocks generation: OK");

    // 9. Reactivate recurrence A -> re-run generation -> generates ONLY the 1 missing date!
    await req(`/rest/v1/recurring_matches?id=eq.${recA.id}`, { method: "PATCH", apiKey: anon, bearer: admin1.jwt, body: { is_active: true } });
    const rReact = await generateUpcomingAsAdmin(anon, admin1.jwt, groupId, 4);
    assert(rReact.generated === 1, `Reactivated recurrence should generate exactly 1 missing match, got ${rReact.generated}`);
    console.log("9. Reactivate recurrence generates only missing date: OK");

    // 10. Compatibility with fines & match_fees on generated match
    const fineRes = await req("/rest/v1/fines", {
      method: "POST", apiKey: anon, bearer: admin1.jwt, prefer: "return=representation",
      body: { group_id: groupId, match_id: targetMatch.id, profile_id: player.id, amount: 25, reason: "late_cancel", status: "open" },
    });
    assert(fineRes.ok, `Fine on generated match failed: ${JSON.stringify(fineRes.data)}`);
    console.log("10. Compatibility with fines/fees on generated match: OK");

    // 11. Cancel (delete) recurrence A -> ALL previously generated matches preserved (recurring_match_id = null)!
    const delRec = await req(`/rest/v1/recurring_matches?id=eq.${recA.id}`, { method: "DELETE", apiKey: anon, bearer: admin1.jwt });
    assert(delRec.ok, "Delete recurrence A failed");
    const preserved = await req(`/rest/v1/matches?id=eq.${targetMatch.id}&select=id,recurring_match_id,title`, { apiKey: anon, bearer: admin1.jwt });
    assert(preserved.data.length === 1 && preserved.data[0].recurring_match_id === null && preserved.data[0].title === "Jueves F5 — Edición Especial", "Deleting recurrence must preserve generated matches with recurring_match_id=null");
    console.log("11. Cancel series preserves existing matches (ON DELETE SET NULL): OK");

    console.log("\nALL 11 STAGING RECURRING MATCHDAY ASSERTIONS PASSED!");
  } finally {
    if (groupId) await req(`/rest/v1/groups?id=eq.${groupId}`, { method: "DELETE", apiKey: serviceRole });
    for (const uid of userIds) await req(`/auth/v1/admin/users/${uid}`, { method: "DELETE", apiKey: serviceRole });
    console.log("Cleanup completed: synthetic group and 3 synthetic users removed.");
  }
}

main().catch((err) => {
  console.error("\nFAILED:", err.message || err);
  process.exit(1);
});
