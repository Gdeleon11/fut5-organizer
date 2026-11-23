/* F5 Player Evolution — database rules on Chamusca-Staging (synthetic users, removed at the end).
 * Usage: RADAR_STG_ENV=/path/to/stg.env node scripts/qa-staging/player-evolution-suite.cjs */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs"); const crypto = require("crypto");
const STAGING_REF = "ylynjvssjlmhzgmhkrsd";
const envFile = process.env.RADAR_STG_ENV;
if (!envFile) throw new Error("Set RADAR_STG_ENV to the staging env file.");
const env = Object.fromEntries(fs.readFileSync(envFile, "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
if (!env.STG_URL || !env.STG_URL.includes(STAGING_REF)) throw new Error("Refusing: not the staging project.");
const svc = createClient(env.STG_URL, env.STG_SERVICE, { auth: { persistSession: false } });
const RUN = crypto.randomBytes(3).toString("hex"); const PASS = crypto.randomBytes(18).toString("base64url");
const res = []; const check = (id, ok, d) => { res.push(!!ok); console.log(ok ? "PASS" : "FAIL", id, d !== undefined ? JSON.stringify(d).slice(0, 200) : ""); };
const one = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };
const U = {}; const ids = { users: [], groups: [] };
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function mk(key, role) {
  const email = `pe-qa-${RUN}-${key.toLowerCase()}@example.com`;
  const { data, error } = await svc.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (error) throw new Error("createUser");
  ids.users.push(data.user.id);
  await one(svc.from("profiles").upsert({ id: data.user.id, full_name: `PE ${key}`, nickname: `PE ${key}`, phone: "1", preferred_position: "Midfielder", is_active: true }));
  const c = createClient(env.STG_URL, env.STG_ANON, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password: PASS });
  if (s.error) throw new Error("login");
  U[key] = { id: data.user.id, c, role };
}
const rpc = (k, fn, args) => U[k].c.rpc(fn, args);

(async () => {
  try {
    for (const [k, r] of [["A1", "super_admin"], ["A2", "admin"], ["P1", "player"], ["P2", "player"], ["P3", "player"], ["P4", "player"], ["P5", "player"], ["X", "outsider"]]) await mk(k, r);
    const G = (await one(svc.from("groups").insert({ name: `PE QA ${RUN}`, owner_id: U.A1.id }).select("id").single())).id;
    ids.groups.push(G);
    await one(svc.from("group_members").insert(Object.entries(U).filter(([, v]) => v.role !== "outsider").map(([, v]) => ({ group_id: G, profile_id: v.id, role: v.role, is_active: true }))));
    const M = await one(svc.from("matches").insert({ group_id: G, title: "PE", venue: "Domo", status: "upcoming", max_players: 10, match_date: day(-1), start_time: "19:00" }).select("*").single());
    const F = await one(svc.from("matches").insert({ group_id: G, title: "Futuro", venue: "Domo", status: "upcoming", max_players: 10, match_date: day(3), start_time: "19:00" }).select("*").single());
    const players = ["A1", "A2", "P1", "P2", "P3", "P4"]; // P5 confirmed but not in the lineup
    await one(svc.from("attendances").insert([...players, "P5"].map((k) => ({ match_id: M.id, profile_id: U[k].id, status: "confirmed", checked_in: false }))));
    await one(svc.from("attendances").insert(["P1"].map((k) => ({ match_id: F.id, profile_id: U[k].id, status: "confirmed", checked_in: false }))));
    const teamA = await one(svc.from("teams").insert({ match_id: M.id, name: "A", team_order: 1 }).select("id").single());
    const teamB = await one(svc.from("teams").insert({ match_id: M.id, name: "B", team_order: 2 }).select("id").single());
    await one(svc.from("team_members").insert(players.map((k, i) => ({ team_id: i % 2 ? teamB.id : teamA.id, profile_id: U[k].id }))));

    // --- A. Player style
    let r = await U.P1.c.from("player_styles").insert({ profile_id: U.P1.id, secondary_position: "Forward", attack: 4, defense: 2, passing: 2, pace: 2, goalkeeping: 0 }).select();
    check("A1 player saves own style (10 points)", !r.error && r.data.length === 1, r.error?.message);
    r = await U.P1.c.from("player_styles").update({ attack: 6 }).eq("profile_id", U.P1.id).select();
    check("A2 style must total exactly 10 points", !!r.error, r.error?.message);
    r = await U.P2.c.from("player_styles").insert({ profile_id: U.P1.id, attack: 10 }).select();
    check("A3 nobody can write someone else's style", !!r.error);
    r = await U.P2.c.from("player_styles").select("profile_id").eq("profile_id", U.P1.id);
    check("A4 group mates can read the style", (r.data || []).length === 1);
    r = await U.X.c.from("player_styles").select("profile_id").eq("profile_id", U.P1.id);
    check("A5 outsiders cannot read it", (r.data || []).length === 0);
    r = await U.P1.c.from("player_ratings").insert({ group_id: G, profile_id: U.P1.id, rating: 5, assigned_by: U.P1.id }).select();
    check("A6 a player cannot set their own official rating", !!r.error);

    // --- B. Official stats are not writable by players / own row by admins
    r = await U.P1.c.from("match_player_stats").insert({ group_id: G, match_id: M.id, player_id: U.P1.id, goals: 5 }).select();
    check("B1 player cannot write official stats", !!r.error);
    r = await U.A1.c.from("match_player_stats").insert({ group_id: G, match_id: M.id, player_id: U.A1.id, goals: 5 }).select();
    check("B2 admin cannot write their own official row", !!r.error);

    // --- B. Participants and reporting
    r = await rpc("P1", "postmatch_summary", { p_match_id: M.id });
    check("B3 participants = real lineup (P5 confirmed but not in a team is excluded)", !r.error && r.data.participants.length === 6 && !r.data.participants.includes(U.P5.id), r.error?.message);
    r = await rpc("P1", "postmatch_report", { p_match_id: M.id, p_subject_id: U.P1.id, p_kind: "goal", p_quantity: 2 });
    check("B4 self-reported goal is provisional", r.data?.status === "provisional", r.error?.message);
    let st = await one(svc.from("match_player_stats").select("*").eq("match_id", M.id).eq("player_id", U.P1.id));
    check("B5 provisional events do not touch official stats", st.length === 0);
    r = await rpc("P5", "postmatch_report", { p_match_id: M.id, p_subject_id: U.P5.id, p_kind: "goal", p_quantity: 1 });
    check("B6 someone outside the lineup cannot report", !!r.error, r.error?.message);
    r = await rpc("P1", "postmatch_report", { p_match_id: F.id, p_subject_id: U.P1.id, p_kind: "goal", p_quantity: 1 });
    check("B7 cannot report a match that has not been played", !!r.error, r.error?.message);
    r = await rpc("X", "postmatch_summary", { p_match_id: M.id });
    check("B8 outsiders cannot read the postmatch", !!r.error);

    const ev = (await one(svc.from("match_events").select("*").eq("match_id", M.id).eq("subject_id", U.P1.id)))[0];
    r = await rpc("P2", "postmatch_decide", { p_event_id: ev.id, p_confirm: true });
    check("B9 players cannot confirm events", !!r.error);
    r = await rpc("A1", "postmatch_decide", { p_event_id: ev.id, p_confirm: true });
    st = await one(svc.from("match_player_stats").select("*").eq("match_id", M.id).eq("player_id", U.P1.id));
    check("B10 admin confirms → official stats from events (source postmatch)", !r.error && st[0]?.goals === 2 && st[0].source === "postmatch", st[0]);

    // admin = player
    r = await rpc("A1", "postmatch_report", { p_match_id: M.id, p_subject_id: U.A1.id, p_kind: "goal", p_quantity: 3 });
    check("B11 admin reporting their own goal → provisional", r.data?.status === "provisional", r.error?.message);
    const evA = (await one(svc.from("match_events").select("*").eq("match_id", M.id).eq("subject_id", U.A1.id)))[0];
    r = await rpc("A1", "postmatch_decide", { p_event_id: evA.id, p_confirm: true });
    check("B12 admin cannot confirm their own event", !!r.error, r.error?.message);
    r = await rpc("A2", "postmatch_decide", { p_event_id: evA.id, p_confirm: true });
    check("B13 another admin can confirm it", !r.error && r.data.status === "confirmed");
    r = await rpc("A2", "postmatch_report", { p_match_id: M.id, p_subject_id: U.P2.id, p_kind: "assist", p_quantity: 1 });
    check("B14 admin reporting someone else → confirmed directly", r.data?.status === "confirmed");
    r = await rpc("P2", "postmatch_report", { p_match_id: M.id, p_subject_id: U.P2.id, p_kind: "assist", p_quantity: 4 });
    check("B15 a confirmed value cannot be overwritten by a player (use a correction)", !!r.error, r.error?.message);

    // --- Corrections + history
    r = await rpc("P3", "postmatch_request_correction", { p_match_id: M.id, p_event_id: evA.id, p_message: "Fueron 2, no 3", p_proposed: 2 });
    check("B16 participant requests a correction", !r.error && r.data.status === "open");
    const corr = r.data.id;
    r = await rpc("A1", "postmatch_resolve_correction", { p_correction_id: corr, p_accept: true, p_note: "ok" });
    check("B17 the subject (admin) cannot accept a correction to their own data", !!r.error, r.error?.message);
    r = await rpc("A2", "postmatch_resolve_correction", { p_correction_id: corr, p_accept: true, p_note: "revisado" });
    st = await one(svc.from("match_player_stats").select("*").eq("match_id", M.id).eq("player_id", U.A1.id));
    check("B18 another admin accepts → value and official stats updated", !r.error && st[0]?.goals === 2, st[0]);
    const hist = await one(svc.from("match_event_history").select("action").eq("match_id", M.id));
    const acts = hist.map((h) => h.action);
    check("B19 history records report, confirm, correction and acceptance", ["reported", "confirmed", "correction_requested", "correction_accepted"].every((a) => acts.includes(a)), acts);
    r = await U.A1.c.from("match_event_history").delete().eq("match_id", M.id).select();
    const r2 = await U.A1.c.from("match_events").update({ quantity: 9 }).eq("match_id", M.id).select();
    check("B20 history and events cannot be edited directly (even by admins)", (r.data || []).length === 0 && (r2.data || []).length === 0);

    // --- Legacy rows are never overwritten
    await one(svc.from("match_player_stats").insert({ group_id: G, match_id: M.id, player_id: U.P3.id, goals: 1, created_by: U.A2.id }));
    await rpc("A2", "postmatch_report", { p_match_id: M.id, p_subject_id: U.P3.id, p_kind: "goal", p_quantity: 4 });
    st = await one(svc.from("match_player_stats").select("*").eq("match_id", M.id).eq("player_id", U.P3.id));
    check("B21 historical (legacy) stats are kept untouched", st[0]?.goals === 1 && st[0].source === "legacy", st[0]);
    r = await rpc("P1", "postmatch_summary", { p_match_id: M.id });
    check("B22 summary flags that legacy stats exist", r.data?.legacy_stats === true);

    // --- MVP
    r = await rpc("P1", "postmatch_vote_mvp", { p_match_id: M.id, p_voted_id: U.P1.id });
    check("B23 no self vote", !!r.error, r.error?.message);
    r = await rpc("P5", "postmatch_vote_mvp", { p_match_id: M.id, p_voted_id: U.P1.id });
    check("B24 only participants vote", !!r.error);
    r = await rpc("P1", "postmatch_vote_mvp", { p_match_id: M.id, p_voted_id: U.P5.id });
    check("B25 only participants can be voted", !!r.error);
    await rpc("P1", "postmatch_vote_mvp", { p_match_id: M.id, p_voted_id: U.P2.id });
    await rpc("P1", "postmatch_vote_mvp", { p_match_id: M.id, p_voted_id: U.P3.id });
    const v = await one(svc.from("match_mvp_votes").select("*").eq("match_id", M.id).eq("voter_id", U.P1.id));
    check("B26 voting twice changes the vote, never duplicates it", v.length === 1 && v[0].voted_id === U.P3.id);
    await rpc("P2", "postmatch_vote_mvp", { p_match_id: M.id, p_voted_id: U.P3.id });
    r = await rpc("P1", "postmatch_summary", { p_match_id: M.id });
    check("B27 quorum = max(3, half of the 6 participants) = 3", r.data.mvp.quorum === 3 && r.data.mvp.voters === 2, r.data.mvp);
    r = await rpc("P2", "postmatch_close", { p_match_id: M.id });
    check("B28 players cannot close the postmatch", !!r.error);
    // Second match: insufficient participation → closed without MVP
    const M2 = await one(svc.from("matches").insert({ group_id: G, title: "PE2", venue: "Domo", status: "upcoming", max_players: 10, match_date: day(-2), start_time: "19:00" }).select("*").single());
    await one(svc.from("attendances").insert(players.map((k) => ({ match_id: M2.id, profile_id: U[k].id, status: "confirmed", checked_in: false }))));
    await rpc("P1", "postmatch_vote_mvp", { p_match_id: M2.id, p_voted_id: U.P2.id });
    r = await rpc("A1", "postmatch_close", { p_match_id: M2.id });
    check("B29 insufficient participation → no official MVP", !r.error && r.data.mvp_profile_id === null, r.data);
    // First match: reach quorum with a single leader
    await rpc("P4", "postmatch_vote_mvp", { p_match_id: M.id, p_voted_id: U.P3.id });
    r = await rpc("A2", "postmatch_close", { p_match_id: M.id });
    check("B30 quorum + single leader → official MVP", !r.error && r.data.mvp_profile_id === U.P3.id, r.data);
    r = await rpc("P4", "postmatch_vote_mvp", { p_match_id: M.id, p_voted_id: U.P2.id });
    check("B31 no votes after closing", !!r.error);
    r = await rpc("P1", "postmatch_report", { p_match_id: M.id, p_subject_id: U.P1.id, p_kind: "assist", p_quantity: 1 });
    check("B32 players cannot add events after closing (corrections only)", !!r.error, r.error?.message);
    // Tie → no MVP
    const M3 = await one(svc.from("matches").insert({ group_id: G, title: "PE3", venue: "Domo", status: "upcoming", max_players: 10, match_date: day(-3), start_time: "19:00" }).select("*").single());
    await one(svc.from("attendances").insert(players.map((k) => ({ match_id: M3.id, profile_id: U[k].id, status: "confirmed", checked_in: false }))));
    await rpc("P1", "postmatch_vote_mvp", { p_match_id: M3.id, p_voted_id: U.P2.id });
    await rpc("P2", "postmatch_vote_mvp", { p_match_id: M3.id, p_voted_id: U.P1.id });
    await rpc("P3", "postmatch_vote_mvp", { p_match_id: M3.id, p_voted_id: U.P2.id });
    await rpc("P4", "postmatch_vote_mvp", { p_match_id: M3.id, p_voted_id: U.P1.id });
    r = await rpc("A1", "postmatch_close", { p_match_id: M3.id });
    check("B33 tie at the top → no official MVP", !r.error && r.data.mvp_profile_id === null, r.data);

    // --- V. Match validator (single-admin groups)
    for (const [k, role] of [["S", "super_admin"], ["Q1", "player"], ["Q2", "player"], ["Q3", "player"], ["Q4", "player"]]) await mk(k, role);
    const GS = (await one(svc.from("groups").insert({ name: `PE QA solo ${RUN}`, owner_id: U.S.id }).select("id").single())).id;
    ids.groups.push(GS);
    await one(svc.from("group_members").insert(["S", "Q1", "Q2", "Q3", "Q4"].map((k) => ({ group_id: GS, profile_id: U[k].id, role: U[k].role, is_active: true }))));
    const mkMatch = async (n) => {
      const m = await one(svc.from("matches").insert({ group_id: GS, title: `Solo ${n}`, venue: "Domo", status: "upcoming", max_players: 10, match_date: day(-n), start_time: "19:00" }).select("*").single());
      await one(svc.from("attendances").insert(["S", "Q1", "Q2", "Q3"].map((k) => ({ match_id: m.id, profile_id: U[k].id, status: "confirmed", checked_in: false }))));
      return m;
    };
    const MV = await mkMatch(1); const MV2 = await mkMatch(2);
    r = await rpc("S", "postmatch_summary", { p_match_id: MV.id });
    const rA = await rpc("A1", "postmatch_summary", { p_match_id: M.id });
    check("V1 only a sole admin who played may designate (can_designate)", r.data?.can_designate === true && rA.data?.can_designate === false);
    r = await rpc("A1", "postmatch_set_validator", { p_match_id: M2.id, p_validator_id: U.P1.id });
    check("V2 a group with another admin cannot use a validator", !!r.error, r.error?.message);
    const self = await rpc("S", "postmatch_set_validator", { p_match_id: MV.id, p_validator_id: U.S.id });
    const notPlayed = await rpc("S", "postmatch_set_validator", { p_match_id: MV.id, p_validator_id: U.Q4.id });
    const byPlayer = await rpc("Q1", "postmatch_set_validator", { p_match_id: MV.id, p_validator_id: U.Q2.id });
    check("V3 not yourself, not someone who did not play, not designated by a player", !!self.error && !!notPlayed.error && !!byPlayer.error, [self.error?.message, notPlayed.error?.message, byPlayer.error?.message]);
    await rpc("S", "postmatch_report", { p_match_id: MV.id, p_subject_id: U.S.id, p_kind: "goal", p_quantity: 2 });
    await rpc("Q2", "postmatch_report", { p_match_id: MV.id, p_subject_id: U.Q2.id, p_kind: "goal", p_quantity: 1 });
    r = await rpc("S", "postmatch_set_validator", { p_match_id: MV.id, p_validator_id: U.Q1.id });
    const sum = await rpc("Q1", "postmatch_summary", { p_match_id: MV.id });
    check("V4 sole admin designates Q1; everyone sees it; Q1 knows", !r.error && sum.data?.validator?.validator_id === U.Q1.id && sum.data.i_am_validator === true);
    const evS = (await one(svc.from("match_events").select("id").eq("match_id", MV.id).eq("subject_id", U.S.id)))[0];
    const evQ2 = (await one(svc.from("match_events").select("id").eq("match_id", MV.id).eq("subject_id", U.Q2.id)))[0];
    r = await rpc("Q2", "postmatch_decide", { p_event_id: evS.id, p_confirm: true });
    check("V5 another player (not the validator) cannot confirm the admin's data", !!r.error);
    r = await rpc("Q1", "postmatch_decide", { p_event_id: evQ2.id, p_confirm: true });
    check("V6 the validator cannot confirm other players' data", !!r.error, r.error?.message);
    r = await rpc("Q1", "postmatch_decide", { p_event_id: evS.id, p_confirm: true });
    let stS = await one(svc.from("match_player_stats").select("goals, source").eq("match_id", MV.id).eq("player_id", U.S.id));
    check("V7 the validator confirms the admin's goal → official", !r.error && r.data.as_validator === true && stS[0]?.goals === 2);
    const hv = await one(svc.from("match_event_history").select("action, detail, actor_id").eq("match_id", MV.id));
    check("V8 history shows the designation and the validator's decision", hv.some((h) => h.action === "validator_designated") && hv.some((h) => h.action === "confirmed" && h.detail?.as_validator && h.actor_id === U.Q1.id));
    r = await rpc("S", "postmatch_revoke_validator", { p_match_id: MV.id });
    const swap = await rpc("S", "postmatch_set_validator", { p_match_id: MV.id, p_validator_id: U.Q3.id });
    check("V9 once used, the validator cannot be revoked or swapped", !!r.error && !!swap.error, [r.error?.message, swap.error?.message]);
    await rpc("Q3", "postmatch_request_correction", { p_match_id: MV.id, p_event_id: evS.id, p_message: "Fue 1", p_proposed: 1 });
    await rpc("Q3", "postmatch_request_correction", { p_match_id: MV.id, p_event_id: evQ2.id, p_message: "Fueron 2", p_proposed: 2 });
    const cs = await one(svc.from("match_corrections").select("id, event_id").eq("match_id", MV.id));
    const cS = cs.find((c) => c.event_id === evS.id); const cQ = cs.find((c) => c.event_id === evQ2.id);
    const okS = await rpc("Q1", "postmatch_resolve_correction", { p_correction_id: cS.id, p_accept: true, p_note: null });
    const noQ = await rpc("Q1", "postmatch_resolve_correction", { p_correction_id: cQ.id, p_accept: true, p_note: null });
    stS = await one(svc.from("match_player_stats").select("goals").eq("match_id", MV.id).eq("player_id", U.S.id));
    check("V10 validator resolves corrections only about the admin's data", !okS.error && !!noQ.error && stS[0]?.goals === 1);
    // Second match: rights do not carry over; revoke before use; closing ends the role.
    await rpc("S", "postmatch_report", { p_match_id: MV2.id, p_subject_id: U.S.id, p_kind: "assist", p_quantity: 1 });
    const ev2 = (await one(svc.from("match_events").select("id").eq("match_id", MV2.id).eq("subject_id", U.S.id)))[0];
    r = await rpc("Q1", "postmatch_decide", { p_event_id: ev2.id, p_confirm: true });
    check("V11 a validator of one match has no rights in another", !!r.error);
    await rpc("S", "postmatch_set_validator", { p_match_id: MV2.id, p_validator_id: U.Q1.id });
    const rev = await rpc("S", "postmatch_revoke_validator", { p_match_id: MV2.id });
    const again = await rpc("S", "postmatch_set_validator", { p_match_id: MV2.id, p_validator_id: U.Q2.id });
    const oldRights = await rpc("Q1", "postmatch_decide", { p_event_id: ev2.id, p_confirm: true });
    check("V12 unused validator can be revoked and replaced; the revoked one loses rights", !rev.error && !again.error && !!oldRights.error);
    await rpc("S", "postmatch_close", { p_match_id: MV2.id });
    r = await rpc("Q2", "postmatch_decide", { p_event_id: ev2.id, p_confirm: true });
    const late = await rpc("S", "postmatch_set_validator", { p_match_id: MV2.id, p_validator_id: U.Q3.id });
    check("V13 closing the postmatch ends the validator role", !!r.error && !!late.error);
    r = await U.Q1.c.from("match_validators").insert({ match_id: MV2.id, group_id: GS, validator_id: U.Q1.id, designated_by: U.S.id }).select();
    check("V14 nobody can write match_validators directly", !!r.error);
  } catch (e) {
    check("suite crashed", false, e.message);
  } finally {
    for (const g of ids.groups) await svc.from("groups").delete().eq("id", g);
    for (const u of ids.users) { await svc.from("profiles").delete().eq("id", u); await svc.auth.admin.deleteUser(u); }
    const left = await svc.from("profiles").select("id").in("id", ids.users);
    check("Z cleanup leaves no synthetic users or groups", (left.data || []).length === 0);
    console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
  }
})();
