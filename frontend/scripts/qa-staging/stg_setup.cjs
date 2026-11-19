const { createClient } = require("/Users/Macbook/Projects/fut5-organizer/frontend/node_modules/@supabase/supabase-js");
const crypto = require("crypto"); const fs = require("fs");
const env = Object.fromEntries(fs.readFileSync((process.env.QA_DIR || __dirname) + "/stg.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
if (!env.STG_URL.includes("ylynjvssjlmhzgmhkrsd")) throw new Error("not staging");
const admin = createClient(env.STG_URL, env.STG_SERVICE, { auth: { persistSession: false } });
const USERS = [
  { key: "A", email: "f5qa-appearance-a@f5manager.test", meta: { full_name: "QA Sintético A", nickname: "QA-A", phone: "0000-0001", preferred_position: "Midfielder", qa_marker: "keep-me-A", qa_nested: { a: 1 } } },
  { key: "B", email: "f5qa-appearance-b@f5manager.test", meta: { full_name: "QA Sintético B", nickname: "QA-B", phone: "0000-0002", preferred_position: "Defender", qa_marker: "keep-me-B", f5_appearance: { design: "command", palette: "midnight", updatedAt: 1000 } } },
];
(async () => {
  const out = {};
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of USERS) {
    const password = crypto.randomBytes(18).toString("base64url");
    let user = list.users.find((x) => x.email === u.email);
    if (user) ({ data: { user } } = await admin.auth.admin.updateUserById(user.id, { password, user_metadata: u.meta }));
    else ({ data: { user } } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true, user_metadata: u.meta }));
    // updateUserById merges metadata; reset to the exact baseline:
    out[u.key] = { id: user.id, email: u.email, password };
    await admin.from("profiles").upsert({ id: user.id, full_name: u.meta.full_name, nickname: u.meta.nickname, phone: u.meta.phone, preferred_position: u.meta.preferred_position, is_active: true });
  }
  let { data: g } = await admin.from("groups").select("id").eq("name", "QA Apariencia (sintético)").maybeSingle();
  if (!g) ({ data: g } = await admin.from("groups").insert({ name: "QA Apariencia (sintético)", owner_id: out.A.id }).select("id").single());
  await admin.from("group_members").upsert([
    { group_id: g.id, profile_id: out.A.id, role: "admin", is_active: true },
    { group_id: g.id, profile_id: out.B.id, role: "player", is_active: true },
  ], { onConflict: "group_id,profile_id" });
  const d = new Date(Date.now() + 86400000); const date = d.toISOString().slice(0, 10);
  let { data: m } = await admin.from("matches").select("id").eq("group_id", g.id).eq("title", "Cancha QA sintética").maybeSingle();
  if (!m) ({ data: m } = await admin.from("matches").insert({ group_id: g.id, title: "Cancha QA sintética", venue: "Cancha QA sintética", match_date: date, start_time: "20:00", max_players: 10, status: "upcoming" }).select("id").single());
  else await admin.from("matches").update({ match_date: date }).eq("id", m.id);
  const { data: att } = await admin.from("attendances").select("id").eq("match_id", m.id).eq("profile_id", out.A.id).maybeSingle();
  if (!att) await admin.from("attendances").insert({ match_id: m.id, profile_id: out.A.id, status: "confirmed", checked_in: false });
  out.groupId = g.id; out.matchId = m.id;
  fs.writeFileSync((process.env.QA_DIR || __dirname) + "/stg_users.json", JSON.stringify(out, null, 2), { mode: 0o600 });
  console.log("users", Object.keys(out).filter((k) => k.length === 1).map((k) => `${k}=${out[k].email} ${out[k].id}`), "group", g.id, "match", m.id);
})().catch((e) => { console.error(e); process.exit(1); });
