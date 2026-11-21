/* F5 Radar MVP — database suite for Chamusca-Staging ONLY.
 *
 * Covers: RLS matrix on new and existing tables, RPC rules, notifications, capacity under
 * concurrency, privacy (key sets and leaked values), private-match regression, cleanup.
 *
 * Usage: RADAR_STG_ENV=/path/to/stg.env node scripts/qa-staging/radar-suite.cjs
 *   stg.env holds STG_URL, STG_ANON, STG_SERVICE (never committed). The script refuses to run
 *   against any project other than Staging. All accounts and rows are synthetic and removed.
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const crypto = require("crypto");

const STAGING_REF = "ylynjvssjlmhzgmhkrsd";
const envFile = process.env.RADAR_STG_ENV;
if (!envFile) throw new Error("Set RADAR_STG_ENV to the staging env file.");
const env = Object.fromEntries(fs.readFileSync(envFile, "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
if (!env.STG_URL || !env.STG_URL.includes(STAGING_REF)) throw new Error("Refusing: not the staging project.");

const svc = createClient(env.STG_URL, env.STG_SERVICE, { auth: { persistSession: false } });
const anon = createClient(env.STG_URL, env.STG_ANON, { auth: { persistSession: false } });
const RUN = crypto.randomBytes(3).toString("hex");
const PASS = crypto.randomBytes(18).toString("base64url");
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail !== undefined ? " " + JSON.stringify(detail).slice(0, 300) : ""}`);
};
const SECRET_PHONE = "5555-0" + RUN;
const SECRET_NAME = "Nombre Secreto " + RUN;
const ADDRESS = "Calle privada 7-" + RUN;
const LAT = 14.6349, LNG = -90.5069;

const users = {};
const clients = {};
const ids = { groups: [], users: [] };

function day(n, time = "19:00") {
  const d = new Date(Date.now() + n * 86400000);
  return { match_date: d.toISOString().slice(0, 10), start_time: time };
}
// A start time about `hours` from now, expressed in America/Guatemala (UTC-6, no DST).
function inHours(hours) {
  const t = new Date(Date.now() + hours * 3600000 - 6 * 3600000);
  return { match_date: t.toISOString().slice(0, 10), start_time: t.toISOString().slice(11, 16) };
}
const errMsg = (e) => (e && (e.message || e.details || e.code)) || "";

async function mkUser(key, { nickname = `QA ${key}`, ...profile } = {}) {
  const email = `radar-qa-${RUN}-${key.toLowerCase()}@example.com`;
  const { data, error } = await svc.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (error) throw new Error(`createUser ${key}: ${error.message}`);
  const id = data.user.id;
  ids.users.push(id);
  const { error: pe } = await svc.from("profiles").upsert({
    id, full_name: SECRET_NAME, nickname, phone: SECRET_PHONE, preferred_position: "Flexible", is_active: true, ...profile,
  });
  if (pe) throw new Error(`profile ${key}: ${pe.message}`);
  const c = createClient(env.STG_URL, env.STG_ANON, { auth: { persistSession: false } });
  const { error: le } = await c.auth.signInWithPassword({ email, password: PASS });
  if (le) throw new Error(`login ${key}`);
  users[key] = id;
  clients[key] = c;
  return id;
}

async function one(q) { const { data, error } = await q; if (error) throw new Error(errMsg(error)); return data; }
async function rpc(who, fn, args = {}) { const c = who === "anon" ? anon : clients[who]; return c.rpc(fn, args); }

async function main() {
  console.log(`run ${RUN} on staging`);
  // ---------- setup ----------
  for (const k of ["SA", "AD", "PL", "P2", "P3", "P4", "G2A", "O1", "O2", "O4", "O5", "O6", "O7", "O8"]) await mkUser(k);
  await mkUser("O3", { nickname: "" });

  const G1 = (await one(svc.from("groups").insert({ name: `Radar QA ${RUN}`, owner_id: users.SA }).select("id").single())).id;
  const G2 = (await one(svc.from("groups").insert({ name: `Radar QA2 ${RUN}`, owner_id: users.G2A }).select("id").single())).id;
  ids.groups.push(G1, G2);
  await one(svc.from("group_members").insert([
    { group_id: G1, profile_id: users.SA, role: "super_admin", is_active: true },
    { group_id: G1, profile_id: users.AD, role: "admin", is_active: true },
    { group_id: G1, profile_id: users.PL, role: "player", is_active: true },
    { group_id: G1, profile_id: users.P2, role: "player", is_active: true },
    { group_id: G1, profile_id: users.P3, role: "player", is_active: true },
    { group_id: G1, profile_id: users.P4, role: "player", is_active: true },
    { group_id: G2, profile_id: users.G2A, role: "super_admin", is_active: true },
  ]));
  await one(svc.from("settings").insert({ group_id: G1, fine_amount: 50, late_cancel_fine_amount: 30 }));
  const V1 = (await one(svc.from("venues").insert({ group_id: G1, name: `Cancha QA ${RUN}`, address: ADDRESS, lat: LAT, lng: LNG, default_cost: 300 }).select("id").single())).id;
  const V2 = (await one(svc.from("venues").insert({ group_id: G1, name: `Sin mapa ${RUN}`, address: "x" }).select("id").single())).id;

  const mk = (title, extra) => one(svc.from("matches").insert({ group_id: G1, title, venue: "QA", venue_id: V1, status: "upcoming", max_players: 10, court_cost: 300, ...extra }).select("*").single());
  const M1 = await mk(`M1 ${SECRET_NAME}`, day(3));
  const M2 = await mk("M2 private", { ...day(3), max_players: 2 });
  const M3 = await mk("M3 tags", { ...day(3), allowed_tags: ["residente"] });
  const M4 = await mk("M4 no map", { ...day(3), venue_id: V2 });
  const M5 = await mk("M5 capacity", { ...day(4), max_players: 6 });
  const M6 = await mk("M6 late", { ...inHours(2) });
  const M7 = await mk("M7 changes", day(5));
  const M8 = await mk("M8 pending cap a", day(6));
  const M9 = await mk("M9 pending cap b", day(6, "20:00"));

  // ---------- A. group switch ----------
  let r = await rpc("AD", "radar_set_group_settings", { p_group_id: G1, p_enabled: true });
  check("A1 admin (not super) cannot enable Radar", r.error && /super admin/i.test(errMsg(r.error)));
  r = await rpc("AD", "radar_publish_match", { p_match_id: M1.id, p_radar_slots: 3 });
  check("A2 publish refused while Radar is off", r.error && /desactivado/i.test(errMsg(r.error)), errMsg(r.error));
  r = await clients.PL.from("radar_group_settings").insert({ group_id: G1, enabled: true });
  check("A3 direct insert into radar_group_settings denied", !!r.error);
  r = await rpc("SA", "radar_set_group_settings", { p_group_id: G1, p_enabled: true });
  check("A4 super admin enables Radar", !r.error && r.data?.enabled === true, errMsg(r.error));

  // ---------- B. publish ----------
  r = await rpc("PL", "radar_publish_match", { p_match_id: M1.id, p_radar_slots: 3 });
  check("B1 player cannot publish", r.error && /admin/i.test(errMsg(r.error)));
  r = await rpc("G2A", "radar_publish_match", { p_match_id: M1.id, p_radar_slots: 3 });
  check("B2 other group's admin cannot publish", r.error && /admin/i.test(errMsg(r.error)));
  r = await rpc("AD", "radar_publish_match", { p_match_id: M3.id, p_radar_slots: 2 });
  check("B3 tag-restricted match refused", r.error && /tags/i.test(errMsg(r.error)));
  r = await rpc("AD", "radar_publish_match", { p_match_id: M4.id, p_radar_slots: 2 });
  check("B4 venue without coordinates refused", r.error && /ubicación/i.test(errMsg(r.error)));
  r = await rpc("AD", "radar_publish_match", { p_match_id: M1.id, p_radar_slots: 11 });
  check("B5 more Radar slots than free refused", r.error && /cupos/i.test(errMsg(r.error)));
  r = await rpc("AD", "radar_publish_match", { p_match_id: M1.id, p_radar_slots: 3, p_level_band: "intermedio", p_positions: ["Goalkeeper"], p_note: "Falta portero", p_zone_label: "Zona 10" });
  check("B6 admin publishes M1", !r.error && r.data?.status === "open", errMsg(r.error));
  const L1 = r.data?.id;
  const pub = async (m, slots, extra = {}) => { const x = await rpc("AD", "radar_publish_match", { p_match_id: m.id, p_radar_slots: slots, p_zone_label: "Zona 10", ...extra }); if (x.error) throw new Error(`publish ${m.title}: ${errMsg(x.error)}`); return x.data.id; };
  const L5 = await pub(M5, 2); const L6 = await pub(M6, 3); const L7 = await pub(M7, 3); const L8 = await pub(M8, 2); const L9 = await pub(M9, 2);
  check("B7 late match published with a close time before start", !!L6);

  // ---------- C. discovery and isolation ----------
  r = await rpc("O1", "radar_nearby", { p_lat: LAT + 0.004, p_lng: LNG + 0.004, p_radius_km: 10 });
  const rows = r.data || [];
  const row1 = rows.find((x) => x.listing_id === L1);
  check("C1 outsider discovers M1 nearby", !r.error && !!row1, errMsg(r.error));
  const expectedKeys = ["listing_id", "match_date", "start_time", "venue_name", "zone_label", "distance_bucket", "bucket_rank", "max_players", "occupancy", "radar_slots_left", "level_band", "positions", "note", "cost_hint", "organizer_label", "my_request_status"].sort();
  check("C2 radar_nearby returns exactly the allow-listed keys", row1 && JSON.stringify(Object.keys(row1).sort()) === JSON.stringify(expectedKeys), row1 && Object.keys(row1));
  check("C3 distance is a bucket and the group name is hidden", row1?.distance_bucket === "<2 km" && row1?.organizer_label === "Grupo privado", row1 && [row1.distance_bucket, row1.organizer_label]);
  const leaks = (obj) => {
    const s = JSON.stringify(obj);
    return [M1.id, M2.id, M5.id, G1, G2, ADDRESS, SECRET_PHONE, SECRET_NAME, String(LAT), String(LNG), "Radar QA " + RUN].filter((v) => s.includes(v));
  };
  check("C4 discovery leaks no ids, address, coordinates, title, phone or name", leaks(rows).length === 0, leaks(rows));
  check("C5 private match M2 never listed", !rows.some((x) => x.zone_label && x.max_players === 2));
  r = await rpc("PL", "radar_nearby", { p_lat: LAT, p_lng: LNG });
  check("C6 members do not see their own group's listings", !r.error && !(r.data || []).some((x) => x.listing_id === L1));
  r = await rpc("O1", "radar_nearby", { p_lat: LAT + 0.5, p_lng: LNG, p_radius_km: 15 });
  check("C7 far away (≈55 km) returns nothing from this group", !r.error && !(r.data || []).some((x) => x.listing_id === L1));
  r = await rpc("O1", "radar_nearby", { p_zone: "zona 10" });
  check("C8 zone filter (no location) finds M1", !r.error && (r.data || []).some((x) => x.listing_id === L1 && x.distance_bucket === null));
  r = await rpc("O1", "radar_zones");
  check("C9 zone list includes Zona 10", !r.error && (r.data || []).some((z) => z.zone_label === "Zona 10"));
  r = await rpc("anon", "radar_nearby", {});
  check("C10 anonymous cannot call Radar RPCs", !!r.error);
  for (const t of ["matches", "attendances", "profiles", "venues", "match_fees", "fines", "groups", "group_members", "settings", "radar_listings", "radar_group_settings"]) {
    const q = await clients.O1.from(t).select("*").limit(50);
    const own = t === "profiles" ? (q.data || []).filter((p) => p.id !== users.O1) : q.data || [];
    check(`C11 outsider reads 0 rows of ${t}`, !q.error && own.length === 0, q.error ? errMsg(q.error) : own.length);
  }
  r = await rpc("O1", "radar_listing_card", { p_listing_id: L1 });
  check("C12 listing card: no private data before approval", !r.error && r.data?.private === null && r.data?.rules?.late_cancel_fine_amount === 30 && leaks(r.data).length === 0, errMsg(r.error) || leaks(r.data));
  r = await rpc("O1", "radar_listing_card", { p_listing_id: crypto.randomUUID() });
  check("C13 unknown listing → not available", r.error && /no disponible/i.test(errMsg(r.error)));

  // ---------- D. requests ----------
  r = await rpc("O3", "radar_request_spot", { p_listing_id: L1 });
  check("D1 nickname required", r.error && /apodo/i.test(errMsg(r.error)));
  r = await rpc("PL", "radar_request_spot", { p_listing_id: L1 });
  check("D2 group member cannot request", r.error && /grupo/i.test(errMsg(r.error)));
  r = await rpc("O1", "radar_request_spot", { p_listing_id: L1, p_position: "Goalkeeper", p_message: "Atajo  bien" });
  check("D3 outsider requests a spot", !r.error && r.data?.status === "pending", errMsg(r.error));
  const R1 = r.data?.request_id;
  r = await rpc("O1", "radar_request_spot", { p_listing_id: L1 });
  check("D4 duplicate request refused", r.error && /ya tenés/i.test(errMsg(r.error)));
  const par = await Promise.all(Array.from({ length: 10 }, () => rpc("O2", "radar_request_spot", { p_listing_id: L1 })));
  const okPar = par.filter((x) => !x.error).length;
  const cnt = await one(svc.from("radar_requests").select("id", { count: "exact", head: false }).eq("listing_id", L1).eq("requester_id", users.O2));
  check("D5 10 parallel requests by one user → exactly one row", okPar === 1 && cnt.length === 1, { okPar, rows: cnt.length });
  const R2 = cnt[0]?.id;
  await one(svc.from("radar_requests").insert(Array.from({ length: 10 }, () => ({ listing_id: L7, match_id: M7.id, group_id: G1, requester_id: users.O4, status: "withdrawn" }))));
  r = await rpc("O4", "radar_request_spot", { p_listing_id: L1 });
  check("D6 daily limit of 10 requests", r.error && /10 solicitudes/i.test(errMsg(r.error)));
  for (const L of [L5, L8, L9]) { const x = await rpc("O5", "radar_request_spot", { p_listing_id: L }); if (x.error) throw new Error("O5 setup " + errMsg(x.error)); }
  r = await rpc("O5", "radar_request_spot", { p_listing_id: L1 });
  check("D7 at most 3 pending requests", r.error && /3 solicitudes pendientes/i.test(errMsg(r.error)));
  r = await rpc("O7", "radar_request_spot", { p_listing_id: L1, p_message: "x".repeat(281) });
  check("D8 message length enforced", r.error && /280/.test(errMsg(r.error)), errMsg(r.error));
  const adminNotes = await one(svc.from("app_notifications").select("recipient_id, kind, body").eq("request_id", R1));
  const recips = new Set(adminNotes.map((n) => n.recipient_id));
  check("D9 request notifies G1 admins only", recips.has(users.SA) && recips.has(users.AD) && !recips.has(users.PL) && !recips.has(users.G2A) && adminNotes.every((n) => !n.body.includes(SECRET_NAME) && !n.body.includes(SECRET_PHONE)), [...recips].length);
  r = await clients.O1.from("radar_requests").select("id, requester_id");
  check("D10 outsider sees only own requests", !r.error && r.data.every((x) => x.requester_id === users.O1));
  r = await clients.PL.from("radar_requests").select("id");
  check("D11 group player cannot read requests", !r.error && r.data.length === 0);

  // ---------- E. decisions ----------
  r = await rpc("PL", "radar_decide_request", { p_request_id: R1, p_approve: true });
  check("E1 player cannot decide", r.error && /admin/i.test(errMsg(r.error)));
  r = await rpc("G2A", "radar_decide_request", { p_request_id: R1, p_approve: true });
  check("E2 other group's admin cannot decide", r.error && /admin/i.test(errMsg(r.error)));
  r = await rpc("AD", "radar_admin_requests", { p_match_id: M1.id });
  check("E3 admin inbox lists requests with nickname only", !r.error && r.data.length >= 2 && r.data.every((x) => !JSON.stringify(x).includes(SECRET_NAME) && !JSON.stringify(x).includes(SECRET_PHONE)), errMsg(r.error));
  r = await rpc("PL", "radar_admin_requests", { p_match_id: M1.id });
  check("E4 player cannot open the inbox", !!r.error);
  r = await rpc("AD", "radar_decide_request", { p_request_id: R1, p_approve: true });
  check("E5 admin approves O1", !r.error && r.data?.status === "approved" && (r.data.confirmed_profile_ids || []).includes(users.O1), errMsg(r.error));
  const att = await one(svc.from("attendances").select("status").eq("match_id", M1.id).eq("profile_id", users.O1));
  check("E6 approval creates a confirmed attendance", att[0]?.status === "confirmed");
  r = await rpc("AD", "radar_decide_request", { p_request_id: R1, p_approve: true });
  check("E7 second decision refused", r.error && /ya fue respondida/i.test(errMsg(r.error)));
  // Existing fee flow, run by the admin (same as api.upsertMatchFee)
  const fee = await one(clients.AD.from("match_fees").upsert({ match_id: M1.id, group_id: G1, total_amount: 300, per_player_amount: 300, status: "open" }, { onConflict: "match_id" }).select("*").single());
  r = await clients.AD.from("match_fee_payments").insert({ match_fee_id: fee.id, group_id: G1, profile_id: users.O1, status: "pending" });
  check("E8 admin can create the outsider's payment row (existing policy)", !r.error, errMsg(r.error));
  r = await rpc("O1", "radar_listing_card", { p_listing_id: L1 });
  check("E9 approved card shows address, fee and payment status", !r.error && r.data?.private?.venue_address === ADDRESS && Number(r.data.private.per_player_amount) === 300 && r.data.private.payment_status === "pending", r.data?.private);
  for (const t of ["matches", "attendances", "match_fee_payments", "fines"]) {
    const q = await clients.O1.from(t).select("*").limit(5);
    check(`E10 approved outsider still reads 0 rows of ${t}`, !q.error && (q.data || []).length === 0);
  }
  r = await rpc("O1", "radar_match_people", { p_listing_id: L1 });
  const people = r.data || [];
  check("E11 roster: nicknames only, own id only", !r.error && people.some((p) => p.is_me && p.profile_id === users.O1) && people.filter((p) => !p.is_me).every((p) => p.profile_id === null) && leaks(people).length === 0, errMsg(r.error));
  r = await rpc("O2", "radar_match_people", { p_listing_id: L1 });
  check("E12 pending requester cannot read the roster", !!r.error);
  r = await rpc("AD", "radar_decide_request", { p_request_id: R2, p_approve: false, p_note: "Ya tenemos portero" });
  check("E13 admin rejects O2 with a note", !r.error && r.data?.status === "rejected");
  r = await rpc("O2", "radar_request_spot", { p_listing_id: L1 });
  check("E14 rejected user cannot re-request the same match", r.error && /ya respondió/i.test(errMsg(r.error)));
  const n1 = await one(clients.O1.from("app_notifications").select("kind"));
  const n2 = await one(clients.O2.from("app_notifications").select("kind, body"));
  check("E15 requester notifications (approved / rejected with note)", n1.some((n) => n.kind === "radar_request_approved") && n2.some((n) => n.kind === "radar_request_rejected" && n.body.includes("portero")));
  r = await clients.AD.from("group_members").insert({ group_id: G1, profile_id: users.O1, role: "player", is_active: false });
  const o1member = await one(svc.from("group_members").select("id").eq("group_id", G1).eq("profile_id", users.O1));
  check("E16a admin cannot turn a Radar player into a member (old orphan repair)", !!r.error && o1member.length === 0, errMsg(r.error));
  r = await rpc("PL", "radar_group_outsiders", { p_group_id: G1 });
  check("E16 members get Radar players' public identity", !r.error && r.data.some((x) => x.profile_id === users.O1 && x.nickname === "QA O1") && !JSON.stringify(r.data).includes(SECRET_PHONE));
  r = await rpc("O2", "radar_group_outsiders", { p_group_id: G1 });
  check("E17 non-members cannot list them", !!r.error);

  // ---------- F. capacity and concurrency (M5: max 6, Radar slots 2) ----------
  await one(svc.from("attendances").insert([users.SA, users.AD, users.P2, users.P3].map((p) => ({ match_id: M5.id, profile_id: p, status: "confirmed", checked_in: false }))));
  const reqs5 = [];
  for (const k of ["O6", "O7", "O8", "O1"]) { const x = await rpc(k, "radar_request_spot", { p_listing_id: L5 }); if (x.error) throw new Error(`req5 ${k} ${errMsg(x.error)}`); reqs5.push(x.data.request_id); }
  const pend5 = await one(svc.from("radar_requests").select("id").eq("listing_id", L5).eq("status", "pending"));
  const race = await Promise.all([
    ...pend5.map((q) => rpc("AD", "radar_decide_request", { p_request_id: q.id, p_approve: true })),
    ...pend5.map((q) => rpc("SA", "radar_decide_request", { p_request_id: q.id, p_approve: true })),
    clients.PL.from("attendances").upsert({ match_id: M5.id, profile_id: users.PL, status: "confirmed", checked_in: false }, { onConflict: "match_id,profile_id" }).select("*"),
    clients.P4.from("attendances").upsert({ match_id: M5.id, profile_id: users.P4, status: "confirmed", checked_in: false }, { onConflict: "match_id,profile_id" }).select("*"),
  ]);
  const occ5 = (await one(svc.from("attendances").select("id").eq("match_id", M5.id).in("status", ["confirmed", "checked_in"]))).length;
  const appr5 = (await one(svc.from("radar_requests").select("id").eq("listing_id", L5).eq("status", "approved"))).length;
  const errs = race.filter((x) => x.error).map((x) => errMsg(x.error));
  const friendly = errs.every((m) => /cupo|respondida|cupos de Radar|deadlock/i.test(m));
  const deadlocks = errs.filter((m) => /deadlock/i.test(m)).length;
  check("F1 parallel approvals + member confirms never exceed max_players", occ5 <= 6 && occ5 === 6, { occ5 });
  check("F2 never more approvals than Radar slots", appr5 <= 2, { appr5 });
  check("F3 losers get clear errors, no deadlocks", friendly && deadlocks === 0, errs.slice(0, 4));
  r = await clients.PL.from("attendances").upsert({ match_id: M5.id, profile_id: users.PL, status: "confirmed", checked_in: false }, { onConflict: "match_id,profile_id" }).select("*");
  const plConfirmed = (await one(svc.from("attendances").select("status").eq("match_id", M5.id).eq("profile_id", users.PL)))[0]?.status === "confirmed";
  check("F4 full Radar match: new confirm refused, re-confirm of a confirmed member allowed", plConfirmed ? !r.error : /cupo/i.test(errMsg(r.error)), { plConfirmed, err: errMsg(r.error) });
  r = await anon.rpc("register_guest_for_match", { p_token: M5.id, p_name: "Invitado QA" });
  check("F5 guest link on a full Radar match refused", r.error && /cupo/i.test(errMsg(r.error)));
  // Private match regression: M2 (max 2) accepts 3 confirmations exactly like today.
  const priv = await Promise.all(["PL", "P2", "P3"].map((k) => clients[k].from("attendances").upsert({ match_id: M2.id, profile_id: users[k], status: "confirmed", checked_in: false }, { onConflict: "match_id,profile_id" }).select("*")));
  check("F6 private match unchanged (no Radar capacity enforcement)", priv.every((x) => !x.error), priv.map((x) => errMsg(x.error)));

  // Approvals-only race: 4 pending requests on M8 (Radar slots 2), approved in parallel by two admins.
  for (const k of ["O6", "O7", "O8"]) { const x = await rpc(k, "radar_request_spot", { p_listing_id: L8 }); if (x.error) throw new Error(`req8 ${k} ${errMsg(x.error)}`); }
  const pend8 = await one(svc.from("radar_requests").select("id").eq("listing_id", L8).eq("status", "pending"));
  const race8 = await Promise.all(pend8.flatMap((q) => [
    rpc("AD", "radar_decide_request", { p_request_id: q.id, p_approve: true }),
    rpc("SA", "radar_decide_request", { p_request_id: q.id, p_approve: true }),
  ]));
  const appr8 = (await one(svc.from("radar_requests").select("id").eq("listing_id", L8).eq("status", "approved"))).length;
  const att8 = (await one(svc.from("attendances").select("id").eq("match_id", M8.id).eq("status", "confirmed"))).length;
  const err8 = race8.filter((x) => x.error).map((x) => errMsg(x.error));
  check("F7 parallel approvals fill exactly the Radar slots", pend8.length === 4 && appr8 === 2 && att8 === 2, { pending: pend8.length, appr8, att8 });
  check("F8 losing approvals get clear errors, no deadlocks", err8.every((m) => /cupos de Radar|respondida/i.test(m)), err8.slice(0, 3));

  // ---------- G. cancellations ----------
  const g1 = await rpc("O6", "radar_request_spot", { p_listing_id: L6 });
  const gd = await rpc("AD", "radar_decide_request", { p_request_id: g1.data?.request_id, p_approve: true });
  r = await rpc("O6", "radar_cancel_spot", { p_request_id: g1.data?.request_id });
  check("G1 late cancel (<4 h) → fine with the group's amount", !gd.error && !r.error && r.data?.late_cancel === true && Number(r.data.fine_amount) === 30, errMsg(gd.error) || errMsg(r.error) || r.data);
  const fine6 = await one(svc.from("fines").select("amount, reason, status").eq("match_id", M6.id).eq("profile_id", users.O6));
  check("G2 fine row is a normal late_cancel fine", fine6.length === 1 && fine6[0].reason === "late_cancel" && fine6[0].status === "open");
  const att6 = await one(svc.from("attendances").select("status").eq("match_id", M6.id).eq("profile_id", users.O6));
  check("G3 attendance canceled and access revoked", att6[0]?.status === "canceled");
  r = await rpc("O6", "radar_my_requests");
  const mine6 = (r.data || []).find((x) => x.id === g1.data?.request_id);
  check("G4 my requests shows the fine, no private extras after cancel", mine6?.fine?.amount == 30 && mine6?.private === null && mine6?.status === "canceled");
  r = await rpc("O1", "radar_cancel_spot", { p_request_id: R1 });
  check("G5 early cancel → no fine", !r.error && r.data?.late_cancel === false && r.data?.fine_amount === null, errMsg(r.error));
  const canceledNote = await one(svc.from("app_notifications").select("recipient_id, kind").eq("request_id", R1).eq("kind", "radar_spot_canceled"));
  check("G6 admins notified of the cancellation", canceledNote.some((n) => n.recipient_id === users.AD));
  r = await rpc("O1", "radar_request_spot", { p_listing_id: L1 });
  check("G7 after canceling, the player may request again", !r.error, errMsg(r.error));
  r = await rpc("O1", "radar_withdraw_request", { p_request_id: r.data?.request_id });
  check("G8 withdraw a pending request", !r.error && r.data?.status === "withdrawn", errMsg(r.error));

  // ---------- H. match changes ----------
  const h1 = await rpc("O7", "radar_request_spot", { p_listing_id: L7 });
  await rpc("AD", "radar_decide_request", { p_request_id: h1.data?.request_id, p_approve: true });
  const h2 = await rpc("O8", "radar_request_spot", { p_listing_id: L7 });
  await one(clients.AD.from("matches").update({ start_time: "21:00" }).eq("id", M7.id).select("id"));
  let n7 = await one(clients.O7.from("app_notifications").select("kind"));
  check("H1 reschedule notifies the approved player", n7.some((n) => n.kind === "radar_match_changed"));
  await one(clients.AD.from("matches").update({ status: "canceled" }).eq("id", M7.id).select("id"));
  n7 = await one(clients.O7.from("app_notifications").select("kind"));
  const st8 = await one(svc.from("radar_requests").select("status").eq("id", h2.data?.request_id));
  const l7 = await one(svc.from("radar_listings").select("status").eq("id", L7));
  check("H2 cancel closes the listing, expires pending and notifies", n7.some((n) => n.kind === "radar_match_canceled") && st8[0]?.status === "expired" && l7[0]?.status === "closed");

  // ---------- I. bans, notifications, switch off ----------
  const o5pending = await one(svc.from("radar_requests").select("id").eq("requester_id", users.O5).eq("status", "pending").limit(1));
  r = await rpc("AD", "radar_ban_requester", { p_request_id: o5pending[0]?.id });
  const o5left = await one(svc.from("radar_requests").select("id").eq("requester_id", users.O5).eq("status", "pending"));
  const o5see = await rpc("O5", "radar_nearby", { p_zone: "Zona 10" });
  check("I1 ban rejects pending requests and hides the group's listings", !r.error && o5left.length === 0 && (o5see.data || []).length === 0, errMsg(r.error));
  r = await rpc("AD", "radar_group_bans_list", { p_group_id: G1 });
  check("I2 admin sees the ban list (nickname only)", !r.error && r.data.length === 1 && !JSON.stringify(r.data).includes(SECRET_NAME));
  r = await rpc("AD", "radar_unban", { p_group_id: G1, p_profile_id: users.O5 });
  check("I3 admin can unban", !r.error);
  const before = await one(clients.O1.from("app_notifications").select("id").is("read_at", null));
  r = await rpc("O1", "notifications_mark_read", { p_ids: null });
  check("I4 mark all read (own only)", !r.error && r.data === before.length);
  r = await clients.O1.from("app_notifications").update({ read_at: null }).eq("recipient_id", users.O1).select("id");
  check("I5 direct writes to notifications denied", !!r.error || (r.data || []).length === 0);
  r = await clients.O1.from("app_notifications").select("recipient_id");
  check("I6 notifications are private to the recipient", !r.error && r.data.every((x) => x.recipient_id === users.O1));
  r = await rpc("SA", "radar_set_group_settings", { p_group_id: G1, p_enabled: false });
  const openLeft = await one(svc.from("radar_listings").select("id").eq("group_id", G1).neq("status", "closed"));
  const o1after = await rpc("O1", "radar_nearby", { p_zone: "Zona 10" });
  check("I7 switching Radar off closes every listing", !r.error && openLeft.length === 0 && (o1after.data || []).length === 0);
}

async function cleanup() {
  for (const g of ids.groups) await svc.from("groups").delete().eq("id", g);
  for (const u of ids.users) { await svc.from("profiles").delete().eq("id", u); await svc.auth.admin.deleteUser(u); }
  const left = await Promise.all([
    svc.from("groups").select("id").in("id", ids.groups.length ? ids.groups : ["00000000-0000-0000-0000-000000000000"]),
    svc.from("profiles").select("id").in("id", ids.users.length ? ids.users : ["00000000-0000-0000-0000-000000000000"]),
    svc.from("radar_listings").select("id").in("group_id", ids.groups.length ? ids.groups : ["00000000-0000-0000-0000-000000000000"]),
    svc.from("app_notifications").select("id").in("recipient_id", ids.users.length ? ids.users : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  check("Z1 cleanup leaves no synthetic rows", left.every((x) => !x.error && x.data.length === 0), left.map((x) => x.data?.length));
}

main()
  .catch((e) => check("SUITE crashed", false, e.message))
  .finally(async () => {
    try { await cleanup(); } catch (e) { check("Z1 cleanup", false, e.message); }
    const pass = results.filter((r) => r.ok).length;
    console.log(`\n${pass}/${results.length} passed`);
    process.exit(pass === results.length ? 0 : 1);
  });
