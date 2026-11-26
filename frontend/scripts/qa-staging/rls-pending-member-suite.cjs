#!/usr/bin/env node
/**
 * Staging RLS regression suite for pending members (is_active = false).
 *
 * Uses service_role ONLY for creating/cleaning up synthetic test fixtures.
 * Every access check runs with real user JWTs (or anon key) against Staging PostgREST / RPCs.
 *
 * Usage:
 *   node frontend/scripts/qa-staging/rls-pending-member-suite.cjs --mode=reproduce
 *   node frontend/scripts/qa-staging/rls-pending-member-suite.cjs --mode=verify
 */
const { execSync } = require("node:child_process");

const STAGING_REF = "ylynjvssjlmhzgmhkrsd";
const BASE_URL = `https://${STAGING_REF}.supabase.co`;
const MODE = process.argv.includes("--mode=reproduce") ? "reproduce" : "verify";

function getStagingKeys() {
  const raw = execSync(`supabase projects api-keys --project-ref ${STAGING_REF} -o json`, {
    encoding: "utf8",
  });
  const keys = JSON.parse(raw);
  const anon = keys.find((k) => k.name === "anon")?.api_key;
  const serviceRole = keys.find((k) => k.name === "service_role")?.api_key;
  if (!anon || !serviceRole) throw new Error("Missing Staging API keys");
  return { anon, serviceRole };
}

async function req(path, { method = "GET", apiKey, bearer, body, prefer } = {}) {
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${bearer || apiKey}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function createSyntheticUser(srKey, anonKey, tag) {
  const email = `rls-qa-${tag}-${Date.now()}-${Math.floor(Math.random() * 10000)}@f5staging.test`;
  const password = "RlsQaPass!2026Staging";
  const created = await req("/auth/v1/admin/users", {
    method: "POST",
    apiKey: srKey,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `QA ${tag}` },
    },
  });
  if (!created.ok) throw new Error(`Create user ${tag} failed: ${JSON.stringify(created.data)}`);
  const id = created.data.id;

  // Ensure profile row exists
  await req("/rest/v1/profiles", {
    method: "POST",
    apiKey: srKey,
    prefer: "resolution=merge-duplicates",
    body: {
      id,
      full_name: `QA ${tag}`,
      nickname: `QA_${tag}`,
      phone: `5555-${tag.slice(0, 4)}`,
      preferred_position: "Midfielder",
      is_active: true,
    },
  });

  // Real password sign-in to obtain genuine user JWT
  const login = await req("/auth/v1/token?grant_type=password", {
    method: "POST",
    apiKey: anonKey,
    body: { email, password },
  });
  if (!login.ok || !login.data?.access_token) {
    throw new Error(`Sign-in ${tag} failed: ${JSON.stringify(login.data)}`);
  }
  return { id, email, jwt: login.data.access_token };
}

async function probePersona(label, anonKey, jwt, { groupId, matchId, adminId, activeId, teamId, listingId }) {
  const auth = { apiKey: anonKey, bearer: jwt || anonKey };
  const [
    groups,
    gmAll,
    matches,
    attendances,
    venues,
    teams,
    teamMembers,
    stats,
    profilesOthers,
    settings,
    postmatchRpc,
    radarDetailRpc,
  ] = await Promise.all([
    req(`/rest/v1/groups?id=eq.${groupId}&select=id,name`, auth),
    req(`/rest/v1/group_members?group_id=eq.${groupId}&select=id,profile_id,role,is_active`, auth),
    req(`/rest/v1/matches?group_id=eq.${groupId}&select=id,title,venue`, auth),
    req(`/rest/v1/attendances?match_id=eq.${matchId}&select=id,profile_id,status`, auth),
    req(`/rest/v1/venues?group_id=eq.${groupId}&select=id,name`, auth),
    req(`/rest/v1/teams?match_id=eq.${matchId}&select=id,name`, auth),
    req(`/rest/v1/team_members?team_id=eq.${teamId}&select=id,profile_id`, auth),
    req(`/rest/v1/match_player_stats?group_id=eq.${groupId}&select=id,player_id,goals`, auth),
    req(`/rest/v1/profiles?id=in.(${adminId},${activeId})&select=id,full_name,phone`, auth),
    req(`/rest/v1/settings?group_id=eq.${groupId}&select=id,group_id`, auth),
    req("/rest/v1/rpc/postmatch_summary", { method: "POST", ...auth, body: { p_match_id: matchId } }),
    listingId
      ? req("/rest/v1/rpc/radar_listing_detail", { method: "POST", ...auth, body: { p_listing_id: listingId } })
      : Promise.resolve({ ok: false, status: 0, data: null }),
  ]);

  const count = (r) => (Array.isArray(r.data) ? r.data.length : 0);
  return {
    persona: label,
    groups: count(groups),
    group_members: count(gmAll),
    matches: count(matches),
    attendances: count(attendances),
    venues: count(venues),
    teams: count(teams),
    team_members: count(teamMembers),
    match_player_stats: count(stats),
    other_profiles: count(profilesOthers),
    settings: count(settings),
    postmatch_rpc_ok: postmatchRpc.ok,
    radar_detail_ok: radarDetailRpc.ok,
  };
}

async function main() {
  const { anon, serviceRole } = getStagingKeys();
  const createdUserIds = [];
  let groupId = null;

  try {
    console.log(`\n=== F5 RLS PENDING-MEMBER SUITE (mode=${MODE}, project=${STAGING_REF}) ===`);

    // 1. Create 5 synthetic authenticated personas
    const admin = await createSyntheticUser(serviceRole, anon, "admin");
    const active = await createSyntheticUser(serviceRole, anon, "active");
    const pending = await createSyntheticUser(serviceRole, anon, "pending");
    const outsider = await createSyntheticUser(serviceRole, anon, "outsider");
    const radarGuest = await createSyntheticUser(serviceRole, anon, "radarguest");
    createdUserIds.push(admin.id, active.id, pending.id, outsider.id, radarGuest.id);

    // 2. Create synthetic group + admin + active member + venue + match + team + attendance + stats
    const gRes = await req("/rest/v1/groups", {
      method: "POST",
      apiKey: serviceRole,
      prefer: "return=representation",
      body: { name: `QA RLS Private ${Date.now()}`, owner_id: admin.id },
    });
    if (!gRes.ok) throw new Error(`Create group failed: ${JSON.stringify(gRes.data)}`);
    groupId = gRes.data[0].id;

    await req("/rest/v1/group_members", {
      method: "POST",
      apiKey: serviceRole,
      body: [
        { group_id: groupId, profile_id: admin.id, role: "super_admin", is_active: true },
        { group_id: groupId, profile_id: active.id, role: "player", is_active: true },
      ],
    });

    await req("/rest/v1/settings", {
      method: "POST",
      apiKey: serviceRole,
      body: { group_id: groupId, group_name: "QA RLS Private" },
    });

    const vRes = await req("/rest/v1/venues", {
      method: "POST",
      apiKey: serviceRole,
      prefer: "return=representation",
      body: { group_id: groupId, name: "Cancha Privada QA", address: "Zona 14 Privada", lat: 14.59, lng: -90.51 },
    });
    const venueId = vRes.data?.[0]?.id || null;

    const mRes = await req("/rest/v1/matches", {
      method: "POST",
      apiKey: serviceRole,
      prefer: "return=representation",
      body: {
        group_id: groupId,
        venue_id: venueId,
        title: "Partido Privado QA",
        venue: "Cancha Privada QA",
        match_date: "2026-12-10",
        start_time: "20:00",
        max_players: 10,
        status: "upcoming",
      },
    });
    const matchId = mRes.data[0].id;

    await req("/rest/v1/attendances", {
      method: "POST",
      apiKey: serviceRole,
      body: [
        { match_id: matchId, profile_id: admin.id, status: "confirmed", checked_in: false },
        { match_id: matchId, profile_id: active.id, status: "confirmed", checked_in: false },
      ],
    });

    const tRes = await req("/rest/v1/teams", {
      method: "POST",
      apiKey: serviceRole,
      prefer: "return=representation",
      body: { match_id: matchId, name: "Equipo Verde", color: "#5be584", total_rating: 10 },
    });
    const teamId = tRes.data[0].id;

    await req("/rest/v1/team_members", {
      method: "POST",
      apiKey: serviceRole,
      body: [{ team_id: teamId, profile_id: active.id }],
    });

    await req("/rest/v1/match_player_stats", {
      method: "POST",
      apiKey: serviceRole,
      body: { match_id: matchId, group_id: groupId, player_id: active.id, goals: 2, assists: 1, mvp: false },
    });

    // Optional Radar listing + approved guest (tests Radar compatibility & isolation)
    let listingId = null;
    await req("/rest/v1/radar_group_settings", {
      method: "POST",
      apiKey: serviceRole,
      prefer: "resolution=merge-duplicates",
      body: { group_id: groupId, enabled: true, default_slots: 2 },
    });
    const pubRes = await req("/rest/v1/rpc/radar_publish_match", {
      method: "POST",
      apiKey: anon,
      bearer: admin.jwt,
      body: { p_match_id: matchId, p_radar_slots: 2, p_zone_label: "Zona 14", p_note: "QA Radar" },
    });
    if (pubRes.ok && pubRes.data?.id) {
      listingId = pubRes.data.id;
      const reqJoin = await req("/rest/v1/rpc/radar_request_join", {
        method: "POST",
        apiKey: anon,
        bearer: radarGuest.jwt,
        body: { p_listing_id: listingId, p_message: "Hola QA" },
      });
      if (reqJoin.ok && reqJoin.data?.id) {
        await req("/rest/v1/rpc/radar_decide_request", {
          method: "POST",
          apiKey: anon,
          bearer: admin.jwt,
          body: { p_request_id: reqJoin.data.id, p_decision: "approve" },
        });
      }
    }

    // 3. Pending user submits real join request via ?group=<groupId> (using their OWN JWT!)
    const joinRes = await req("/rest/v1/group_members?select=*,groups(*)", {
      method: "POST",
      apiKey: anon,
      bearer: pending.jwt,
      prefer: "return=representation",
      body: { group_id: groupId, profile_id: pending.id, role: "player", is_active: false },
    });
    if (!joinRes.ok) throw new Error(`Pending user joinGroup failed: ${JSON.stringify(joinRes.data)}`);

    const ids = { groupId, matchId, adminId: admin.id, activeId: active.id, teamId, listingId };

    // 4. Probe all 6 personas using real JWTs / anon key
    const results = [];
    results.push(await probePersona("admin", anon, admin.jwt, ids));
    results.push(await probePersona("active", anon, active.jwt, ids));
    results.push(await probePersona("pending", anon, pending.jwt, ids));
    results.push(await probePersona("outsider", anon, outsider.jwt, ids));
    results.push(await probePersona("anon", anon, null, ids));
    results.push(await probePersona("radar_guest", anon, radarGuest.jwt, ids));

    console.table(results);

    const byPersona = Object.fromEntries(results.map((r) => [r.persona, r]));

    if (MODE === "reproduce") {
      const p = byPersona.pending;
      const leaked = p.matches > 0 || p.attendances > 0 || p.venues > 0 || p.teams > 0 || p.other_profiles > 0;
      console.log(leaked
        ? "REPRODUCED: Pending member (is_active=false) CAN read private group data!"
        : "NOT REPRODUCED: Pending member could NOT read private group data.");
      return;
    }

    // VERIFY MODE — strict assertions
    const assert = (cond, msg) => {
      if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
    };

    // Pending member: can see own group_members row (1) and basic groups row (1), ZERO private data!
    const p = byPersona.pending;
    assert(p.groups === 1, `pending should see basic groups row (got ${p.groups})`);
    assert(p.group_members === 1, `pending should see ONLY own group_members row (got ${p.group_members})`);
    assert(p.matches === 0, `pending leaked matches (${p.matches})`);
    assert(p.attendances === 0, `pending leaked attendances (${p.attendances})`);
    assert(p.venues === 0, `pending leaked venues (${p.venues})`);
    assert(p.teams === 0, `pending leaked teams (${p.teams})`);
    assert(p.team_members === 0, `pending leaked team_members (${p.team_members})`);
    assert(p.match_player_stats === 0, `pending leaked match_player_stats (${p.match_player_stats})`);
    assert(p.other_profiles === 0, `pending leaked other_profiles (${p.other_profiles})`);
    assert(p.settings === 0, `pending leaked settings (${p.settings})`);
    assert(p.postmatch_rpc_ok === false, "pending must NOT access postmatch_summary RPC");

    // Admin: sees everything + pending member row (3 members total: admin, active, pending)
    const ad = byPersona.admin;
    assert(ad.groups === 1 && ad.group_members === 3 && ad.matches === 1 && ad.attendances >= 2 && ad.venues === 1 && ad.teams === 1 && ad.team_members === 1 && ad.match_player_stats === 1 && ad.other_profiles === 2 && ad.postmatch_rpc_ok === true, `admin lost access: ${JSON.stringify(ad)}`);

    // Admin can read pending user's profile to display "Activar a <nombre>"
    const adminReadsPending = await req(`/rest/v1/profiles?id=eq.${pending.id}&select=id,full_name`, {
      apiKey: anon,
      bearer: admin.jwt,
    });
    assert(Array.isArray(adminReadsPending.data) && adminReadsPending.data.length === 1, "admin must be able to read pending member profile for activation");

    // Active member: sees group data (matches, venues, teams, stats, active profiles), NOT pending member's profile
    const ac = byPersona.active;
    assert(ac.groups === 1 && ac.matches === 1 && ac.attendances >= 2 && ac.venues === 1 && ac.teams === 1 && ac.team_members === 1 && ac.match_player_stats === 1 && ac.other_profiles === 2 && ac.postmatch_rpc_ok === true, `active member lost access: ${JSON.stringify(ac)}`);
    const activeReadsPending = await req(`/rest/v1/profiles?id=eq.${pending.id}&select=id,full_name`, {
      apiKey: anon,
      bearer: active.jwt,
    });
    assert(Array.isArray(activeReadsPending.data) && activeReadsPending.data.length === 0, "regular active player should not read unapproved pending profile");

    // Outsider & Anon: 0 rows everywhere
    for (const k of ["outsider", "anon"]) {
      const r = byPersona[k];
      assert(r.groups === 0 && r.group_members === 0 && r.matches === 0 && r.attendances === 0 && r.venues === 0 && r.teams === 0 && r.other_profiles === 0 && r.postmatch_rpc_ok === false, `${k} leaked data: ${JSON.stringify(r)}`);
    }

    // Radar approved guest: 0 rows on private group tables, STILL has explicit radar_listing_detail RPC access!
    const rg = byPersona.radar_guest;
    assert(rg.groups === 0 && rg.group_members === 0 && rg.matches === 0 && rg.venues === 0 && rg.teams === 0 && rg.other_profiles === 0, `radar_guest leaked private tables: ${JSON.stringify(rg)}`);
    if (listingId) {
      assert(rg.radar_detail_ok === true, "approved radar_guest lost explicit radar_listing_detail access");
    }

    // 5. Share & Invite end-to-end approval flow: Admin activates pending -> pending immediately sees match & confirms!
    const approveRes = await req(`/rest/v1/group_members?group_id=eq.${groupId}&profile_id=eq.${pending.id}`, {
      method: "PATCH",
      apiKey: anon,
      bearer: admin.jwt,
      prefer: "return=representation",
      body: { is_active: true },
    });
    assert(approveRes.ok && approveRes.data?.[0]?.is_active === true, `admin approval failed: ${JSON.stringify(approveRes.data)}`);

    const postApproval = await probePersona("approved_user", anon, pending.jwt, ids);
    assert(postApproval.matches === 1 && postApproval.venues === 1 && postApproval.teams === 1 && postApproval.other_profiles === 2, `approved user did not gain immediate access: ${JSON.stringify(postApproval)}`);

    const confirmRes = await req("/rest/v1/attendances", {
      method: "POST",
      apiKey: anon,
      bearer: pending.jwt,
      prefer: "return=representation",
      body: { match_id: matchId, profile_id: pending.id, status: "confirmed", checked_in: false },
    });
    assert(confirmRes.ok, `approved user could not confirm attendance: ${JSON.stringify(confirmRes.data)}`);

    console.log("\nALL STAGING RLS ASSERTIONS PASSED (6 personas + Radar + Share & Invite approval flow)!");
  } finally {
    // Cleanup synthetic group (cascades matches, attendances, venues, teams, radar, group_members) and users
    if (groupId) {
      await req(`/rest/v1/groups?id=eq.${groupId}`, { method: "DELETE", apiKey: serviceRole });
    }
    for (const uid of createdUserIds) {
      await req(`/auth/v1/admin/users/${uid}`, { method: "DELETE", apiKey: serviceRole });
    }
    console.log("Cleanup completed: synthetic group and 5 synthetic users removed.");
  }
}

main().catch((err) => {
  console.error("\nFAILED:", err.message || err);
  process.exit(1);
});
