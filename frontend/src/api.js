import { supabase } from "./supabaseClient.js";
import { generateBalancedTeams, playerEffectiveRating } from "./teamGeneration.js";
import { enrichPlayers } from "./teams/balance.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function raise(error) {
  if (error) {
    throw new Error(error.message);
  }
}

/* ------------------------------------------------------------------ */
/* Zona horaria America/Guatemala (UTC-6, sin horario de verano).     */
/* Todos los cálculos de recurrencia se hacen en el calendario local  */
/* de Guatemala para que la fecha generada coincida con la que ve el  */
/* organizador, independientemente de la zona horaria del navegador.  */
/* ------------------------------------------------------------------ */
function guatemalaParts(date = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });
  const parts = f.formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const dowMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const dow = dowMap[parts.find((p) => p.type === "weekday").value];
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    dow,
  };
}

function guatemalaISODate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Mediodía UTC evita problemas de bordes de medianoche al leer/escibir componentes de fecha.
function guatemalaDateFromParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function addGuatemalaDays(year, month, day, days) {
  const d = guatemalaDateFromParts(year, month, day);
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Fecha ISO (AAAA-MM-DD) en Guatemala del siguiente día_día_de_semana >= referencia. */
function nextOccurrenceStr(dayOfWeek, reference = new Date()) {
  const { year, month, day, dow } = guatemalaParts(reference);
  const diff = ((dayOfWeek - dow) % 7 + 7) % 7;
  const target = addGuatemalaDays(year, month, day, diff);
  return guatemalaISODate(target.year, target.month, target.day);
}

/** Fecha ISO (AAAA-MM-DD) en Guatemala `weeks` semanas después de `reference`. */
function addWeeksStr(reference, weeks) {
  const { year, month, day } = guatemalaParts(reference);
  const target = addGuatemalaDays(year, month, day, weeks * 7);
  return guatemalaISODate(target.year, target.month, target.day);
}

/** Fecha ISO de hoy en Guatemala. */
function todayStr() {
  const { year, month, day } = guatemalaParts();
  return guatemalaISODate(year, month, day);
}

async function readOne(query) {
  const { data, error } = await query;
  raise(error);
  return data;
}

async function readMany(query) {
  const { data, error } = await query;
  raise(error);
  return data || [];
}

function profileDefaults(user) {
  const metadata = user?.user_metadata || {};

  return {
    id: user.id,
    full_name: metadata.full_name || metadata.name || "",
    nickname: metadata.nickname || "",
    phone: metadata.phone || "",
    preferred_position: metadata.preferred_position || "Flexible",
    avatar_url: metadata.avatar_url || metadata.picture || null,
  };
}

function safeFileName(name = "avatar") {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\.+/g, ".")
    .slice(0, 80) || "avatar";
}

function fileExtension(file, fallback = "jpg") {
  try {
    const name = file?.name || "";
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx >= 0 && dotIdx < name.length - 1) {
      return name.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || fallback;
    }
    const mimeExtension = file?.type?.split("/").pop()?.replace("jpeg", "jpg");
    return mimeExtension || fallback;
  } catch {
    return fallback;
  }
}

export function extractStorageObjectPath(bucket, urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== "string") return "";
  const clean = urlOrPath.replace(/%0A/g, "").trim();
  if (!clean || clean.startsWith("data:")) return "";
  const marker = `/storage/v1/object/`;
  const idx = clean.indexOf(marker);
  if (idx !== -1) {
    const rest = clean.slice(idx + marker.length).split("?")[0];
    // Matches public/<bucket>/<path>, sign/<bucket>/<path>, or authenticated/<bucket>/<path>
    const match = rest.match(/^(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (match && match[1] === bucket) {
      return decodeURIComponent(match[2]);
    }
    return "";
  }
  if (/^https?:\/\//i.test(clean)) return "";
  return clean.replace(/^\/+/, "");
}

async function resolvePaymentProofUrl(client, urlOrPath, expiresIn = 3600) {
  if (!urlOrPath) return null;
  if (String(urlOrPath).startsWith("data:")) return urlOrPath;
  const objectPath = extractStorageObjectPath("payment-proofs", urlOrPath);
  if (!objectPath) return urlOrPath;
  const { data, error } = await client.storage
    .from("payment-proofs")
    .createSignedUrl(objectPath, expiresIn);
  if (error || !data?.signedUrl) return urlOrPath;
  return data.signedUrl;
}

async function hydratePaymentProofUrls(client, payments = []) {
  if (!Array.isArray(payments) || payments.length === 0) return payments;
  return Promise.all(
    payments.map(async (p) => {
      if (!p?.proof_url) return p;
      const signed = await resolvePaymentProofUrl(client, p.proof_url);
      return { ...p, proof_url: signed };
    }),
  );
}

function safeContentType(file, fallback = "image/jpeg") {
  if (file.type && file.type !== "") return file.type;
  const ext = fileExtension(file);
  const map = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" };
  return map[ext] || fallback;
}

function latestRatingsByProfile(ratings = []) {
  const latest = new Map();

  [...ratings]
    .sort((first, second) => new Date(first.created_at) - new Date(second.created_at))
    .forEach((rating) => {
      const fallback = rating.rating || 2;
      latest.set(rating.profile_id, {
        rating: rating.rating,
        attack_rating: rating.attack_rating || fallback,
        defense_rating: rating.defense_rating || fallback,
        midfield_rating: rating.midfield_rating || fallback,
        goalkeeper_rating: rating.goalkeeper_rating || fallback,
      });
    });

  return latest;
}

/** Devuelve true si ya existe un partido del grupo en esa fecha/hora/venido (evita duplicados). */
async function matchExistsOnDate(groupId, date, startTime, venue, title) {
  const client = requireSupabase();
  const { data } = await client
    .from("matches")
    .select("id, match_date, start_time, venue, title")
    .eq("group_id", groupId)
    .eq("match_date", date);
  if (!data || data.length === 0) return false;
  return data.some(
    (m) =>
      (m.start_time || "") === (startTime || "") &&
      (m.venue || "") === (venue || "") &&
      (m.title || "") === (title || ""),
  );
}

export { guatemalaParts, guatemalaISODate, addGuatemalaDays, nextOccurrenceStr, addWeeksStr, todayStr };

export const api = {
  async getProfile(profileId) {
    const client = requireSupabase();

    return readOne(
      client.from("profiles").select("*").eq("id", profileId).single(),
    );
  },

  async ensureProfile(user) {
    const client = requireSupabase();
    const existing = await readOne(
      client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    );

    if (existing) return existing;

    return readOne(
      client
        .from("profiles")
        .insert(profileDefaults(user))
        .select("*")
        .single(),
    );
  },

  async updateMyProfile(profileId, payload) {
    const client = requireSupabase();

    return readOne(
      client
        .from("profiles")
        .update({
          full_name: payload.full_name,
          nickname: payload.nickname || null,
          phone: payload.phone || null,
          preferred_position: payload.preferred_position || "Flexible",
        })
        .eq("id", profileId)
        .select("*")
        .single(),
    );
  },

  async uploadAvatar(profileId, file) {
    const client = requireSupabase();
    const ext = fileExtension(file) || "jpg";
    const path = `${profileId}/${Date.now()}.${ext}`;
    const { error } = await client.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: safeContentType(file),
        upsert: true,
      });

    if (error) {
      if (error.message?.includes("bucket")) {
        throw new Error("Error de almacenamiento: el bucket 'avatars' no existe. Pedile al admin que corra la migración de storage.");
      }
      raise(error);
    }

    const { data } = client.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = (data?.publicUrl || "").replace(/%0A/g, "").trim();

    return readOne(
      client
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profileId)
        .select("*")
        .single(),
    );
  },

  async uploadMatchPhoto(matchId, file) {
    const client = requireSupabase();
    const ext = fileExtension(file);
    const folder = matchId || "misc";
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await client.storage
      .from("match-photos")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: safeContentType(file),
        upsert: true,
      });

    if (error) {
      if (error.message?.includes("bucket")) {
        throw new Error("Error de almacenamiento: el bucket 'match-photos' no existe.");
      }
      throw new Error(`Error subiendo foto: ${error.message}`);
    }

    const { data: urlData } = client.storage.from("match-photos").getPublicUrl(path);
    const url = (urlData?.publicUrl || "").replace(/%0A/g, "").trim();
    if (!url) throw new Error("No se pudo obtener la URL de la foto.");

    const { data, error: updateError } = await client
      .from("matches")
      .update({ court_photo_url: url })
      .eq("id", matchId)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`Error guardando foto en partido: ${updateError.message}`);
    }
    return data;
  },

  async listMyGroups(profileId) {
    const client = requireSupabase();

    return readMany(
      client
        .from("group_members")
        .select("*, groups(*)")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: true }),
    );
  },

  async createGroup(profileId, name) {
    const client = requireSupabase();
    const group = await readOne(
      client
        .from("groups")
        .insert({ name: name.trim(), owner_id: profileId })
        .select("*")
        .single(),
    );
    const membership = await readOne(
      client
        .from("group_members")
        .insert({
          group_id: group.id,
          profile_id: profileId,
          role: "super_admin",
          is_active: true,
        })
        .select("*, groups(*)")
        .single(),
    );

    await readOne(
      client
        .from("settings")
        .insert({
          group_id: group.id,
          fine_amount: 50,
          late_cancel_fine_amount: 25,
          auto_team_threshold: 10,
        })
        .select("*")
        .single(),
    );

    return membership;
  },

  async searchGroups(query) {
    const client = requireSupabase();
    const term = query.trim();
    if (term.length < 2) return [];

    return readMany(
      client.rpc("search_groups_public", { p_query: term }),
    );
  },

  async updateGroupDescription(groupId, description) {
    const client = requireSupabase();
    return readOne(
      client.from("groups").update({ description }).eq("id", groupId).select("*").single(),
    );
  },

  async joinGroup(groupId, profileId) {
    const client = requireSupabase();
    const payload = {
      group_id: groupId,
      profile_id: profileId,
      role: "player",
      is_active: false,
    };
    const { data, error } = await client
      .from("group_members")
      .insert(payload)
      .select("*, groups(*)")
      .single();

    if (!error) return data;

    if (error.code === "23505") {
      return readOne(
        client
          .from("group_members")
          .select("*, groups(*)")
          .eq("group_id", groupId)
          .eq("profile_id", profileId)
          .single(),
      );
    }

    raise(error);
    return null;
  },

  async listGroupProfiles(groupId) {
    const client = requireSupabase();
    const rows = await readMany(
      client
        .from("group_members")
        .select(
          "id, group_id, profile_id, role, is_active, created_at, profiles(id, full_name, nickname, phone, preferred_position, avatar_url, group_tags, created_at, updated_at)",
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
    );

    return rows
      .filter((row) => row.profiles)
      .map((row) => ({
        ...row.profiles,
        membership_id: row.id,
        membership_role: row.role,
        membership_is_active: row.is_active,
      }));
  },

  async updateGroupMember(groupId, profileId, payload) {
    const client = requireSupabase();

    return readOne(
      client
        .from("group_members")
        .update(payload)
        .eq("group_id", groupId)
        .eq("profile_id", profileId)
        .select("*, groups(*)")
        .single(),
    );
  },

  async updateProfileAdmin(profileId, payload) {
    const client = requireSupabase();
    const allowedPayload = {};

    if (payload.preferred_position) {
      allowedPayload.preferred_position = payload.preferred_position;
    }
    if (Array.isArray(payload.group_tags)) {
      allowedPayload.group_tags = payload.group_tags;
    }

    return readOne(
      client
        .from("profiles")
        .update(allowedPayload)
        .eq("id", profileId)
        .select("*")
        .single(),
    );
  },

  async listGroupTags(groupId) {
    const client = requireSupabase();
    return readMany(
      client
        .from("group_tags")
        .select("*")
        .eq("group_id", groupId)
        .order("name", { ascending: true }),
    );
  },

  async createGroupTag(groupId, name, profileId) {
    const client = requireSupabase();
    return readOne(
      client
        .from("group_tags")
        .upsert(
          { group_id: groupId, name, created_by: profileId },
          { onConflict: "group_id,name" },
        )
        .select("*")
        .single(),
    );
  },

  async listRatings(groupId) {
    const client = requireSupabase();

    return readMany(
      client
        .from("player_ratings")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    );
  },

  async assignRating(groupId, profileId, rating, adminProfileId, positionRatings = {}) {
    const client = requireSupabase();

    return readOne(
      client
        .from("player_ratings")
        .insert({
          group_id: groupId,
          profile_id: profileId,
          rating,
          attack_rating: positionRatings.attack_rating || rating,
          defense_rating: positionRatings.defense_rating || rating,
          midfield_rating: positionRatings.midfield_rating || rating,
          goalkeeper_rating: positionRatings.goalkeeper_rating || rating,
          assigned_by: adminProfileId,
        })
        .select("*")
        .single(),
    );
  },

  async listMatches(groupId) {
    const client = requireSupabase();

    return readMany(
      client
        .from("matches")
        .select("*")
        .eq("group_id", groupId)
        .order("match_date", { ascending: true })
        .order("start_time", { ascending: true }),
    );
  },

  async createMatch(payload) {
    const client = requireSupabase();

    return readOne(client.from("matches").insert(payload).select("*").single());
  },

  async updateMatch(matchId, payload) {
    const client = requireSupabase();

    return readOne(
      client.from("matches").update(payload).eq("id", matchId).select("*").single(),
    );
  },

  async deleteMatch(matchId) {
    const client = requireSupabase();
    const { error, count } = await client
      .from("matches")
      .delete({ count: "exact" })
      .eq("id", matchId);

    raise(error);

    if (count === 0) {
      throw new Error("No se pudo eliminar el partido. Verificá tus permisos.");
    }
  },

  async listAttendances(groupId) {
    const client = requireSupabase();

    return readMany(
      client
        .from("attendances")
        .select("*, matches!inner(group_id)")
        .eq("matches.group_id", groupId)
        .order("created_at", { ascending: false }),
    );
  },

  async confirmAttendance(matchId, profileId) {
    const client = requireSupabase();

    return readOne(
      client
        .from("attendances")
        .upsert(
          {
            match_id: matchId,
            profile_id: profileId,
            status: "confirmed",
            checked_in: false,
          },
          { onConflict: "match_id,profile_id" },
        )
        .select("*")
        .single(),
    );
  },

  async joinWaitlist(matchId, profileId, groupId) {
    const client = requireSupabase();

    return readOne(
      client
        .from("attendances")
        .upsert(
          {
            match_id: matchId,
            profile_id: profileId,
            group_id: groupId,
            status: "waitlist",
            checked_in: false,
          },
          { onConflict: "match_id,profile_id" },
        )
        .select("*")
        .single(),
    );
  },

  async promoteFromWaitlist(matchId) {
    const client = requireSupabase();

    const waitlisted = await readMany(
      client
        .from("attendances")
        .select("*")
        .eq("match_id", matchId)
        .eq("status", "waitlist")
        .order("created_at", { ascending: true })
        .limit(1),
    );

    if (waitlisted.length === 0) return null;

    return readOne(
      client
        .from("attendances")
        .update({ status: "confirmed" })
        .eq("id", waitlisted[0].id)
        .select("*")
        .single(),
    );
  },

  async updateAttendance(attendanceId, payload) {
    const client = requireSupabase();

    return readOne(
      client
        .from("attendances")
        .update(payload)
        .eq("id", attendanceId)
        .select("*")
        .single(),
    );
  },



  /**
   * Cancel an attendance and immediately create a late-cancel fine.
   * Returns { attendance, fine }.
   */
  async cancelAttendance(attendanceId, groupId, profileId, matchId, fineAmount) {
    const client = requireSupabase();

    const attendance = await readOne(
      client
        .from("attendances")
        .update({ status: "canceled", checked_in: false })
        .eq("id", attendanceId)
        .select("*")
        .single(),
    );

    const fine = await readOne(
      client
        .from("fines")
        .insert({
          group_id: groupId,
          profile_id: profileId,
          match_id: matchId,
          reason: "late_cancel",
          amount: fineAmount,
          status: "open",
        })
        .select("*")
        .single(),
    );

    return { attendance, fine };
  },

  async listTeams(matchId) {
    const client = requireSupabase();

    const teams = await readMany(
      client
        .from("teams")
        .select(
          "*, team_members(*, profiles(id, full_name, nickname, preferred_position, avatar_url))",
        )
        .eq("match_id", matchId)
        .order("team_order", { ascending: true }),
    );

    const guestIds = teams.flatMap((t) =>
      (t.team_members || []).filter((m) => m.guest_player_id).map((m) => m.guest_player_id),
    );

    if (guestIds.length > 0) {
      const guests = await readMany(
        client.from("guest_players").select("id, name, rating").in("id", guestIds),
      );
      const guestMap = new Map(guests.map((g) => [g.id, g]));
      teams.forEach((t) => {
        (t.team_members || []).forEach((m) => {
          if (m.guest_player_id) {
            const g = guestMap.get(m.guest_player_id);
            if (g) m.guest_name = g.name;
          }
        });
      });
    }

    return teams;
  },

  async listAllTeams(matches = []) {
    const pairs = await Promise.all(
      matches.map(async (match) => [match.id, await api.listTeams(match.id)]),
    );

    return Object.fromEntries(pairs);
  },

  async updateTeamColor(teamId, color) {
    const client = requireSupabase();
    return client.from("teams").update({ color }).eq("id", teamId);
  },

  async generateTeamsForMatch(match, profiles, attendances, ratings, options = {}) {
    const client = requireSupabase();
    const matchAttendances = attendances.filter(
      (a) => a.match_id === match.id && ["confirmed", "checked_in"].includes(a.status),
    );
    const confirmedIds = matchAttendances.map((a) => a.profile_id);
    const ratingMap = latestRatingsByProfile(ratings);

    let players = profiles
      .filter((p) => p.membership_is_active && confirmedIds.includes(p.id))
      .map((p) => {
        const r = ratingMap.get(p.id) || {};
        return {
          ...p,
          rating: r.rating || 2,
          attack_rating: r.attack_rating || r.rating || 2,
          defense_rating: r.defense_rating || r.rating || 2,
          midfield_rating: r.midfield_rating || r.rating || 2,
          goalkeeper_rating: r.goalkeeper_rating || r.rating || 2,
        };
      });

    console.log(`Generando equipos: ${confirmedIds.length} confirmados, ${players.length} jugadores activos`);

    const guests = await readMany(
      client.from("guest_players").select("*").eq("match_id", match.id),
    );
    const guestPlayers = guests.map((g) => ({
      id: g.id,
      full_name: g.name,
      nickname: null,
      preferred_position: "Flexible",
      membership_is_active: true,
      is_guest: true,
      rating: g.rating || 2,
      attack_rating: g.rating || 2,
      defense_rating: g.rating || 2,
      midfield_rating: g.rating || 2,
      goalkeeper_rating: g.rating || 2,
    }));
    players = [...players, ...guestPlayers];

    const confirmationTimes = new Map();
    matchAttendances.forEach((a) => {
      confirmationTimes.set(a.profile_id, new Date(a.updated_at || a.created_at || Date.now()).getTime());
    });
    guests.forEach((g) => {
      confirmationTimes.set(g.id, new Date(g.updated_at || g.created_at || Date.now()).getTime());
    });

    players = players.map((p) => ({
      ...p,
      confirmed_at: confirmationTimes.get(p.id) || Date.now(),
    }));

    let playerSkills = [];
    try {
      playerSkills = await readMany(
        client.from("player_skills").select("player_id, skill").eq("group_id", match.group_id).in("player_id", confirmedIds),
      );
    } catch (e) {
      console.warn("Skills not available:", e.message);
    }
    const skillsByPlayer = new Map();
    playerSkills.forEach((s) => {
      if (!skillsByPlayer.has(s.player_id)) skillsByPlayer.set(s.player_id, []);
      skillsByPlayer.get(s.player_id).push(s.skill);
    });
    players = players.map((p) => ({
      ...p,
      skills: p.is_guest ? [] : (skillsByPlayer.get(p.id) || []),
    }));

    // Strength with evidence weighting: official rating or group average (new players are not
    // penalised), confirmed results weigh more as they accumulate; style only sets role/goalkeeper.
    players = enrichPlayers(players, {
      ratingMap,
      stats: options.balance?.stats || [],
      styles: options.balance?.styles || new Map(),
    });

    let penaltyTeam = null;

    if (options.penaltyTeam && players.length === 14) {
      // 14 players: force last 4 confirmed to be the 3rd team
      const sortedByTime = [...players].sort((a, b) => a.confirmed_at - b.confirmed_at);
      const topTen = sortedByTime.slice(0, 10);
      const lastFour = sortedByTime.slice(10);
      penaltyTeam = lastFour;
      players = topTen;
    } else if (options.penaltyTeam && players.length === 13) {
      const sortedByRating = [...players].sort((a, b) => b.rating - a.rating);
      const topTen = sortedByRating.slice(0, 10);
      const rest = sortedByRating.slice(10);
      penaltyTeam = rest;
      players = topTen;
    }

    let generated;
    if (options.aiAssignments && Array.isArray(options.aiAssignments)) {
      const playerMap = new Map(players.map((p) => [p.id, p]));
      const aiTeams = options.aiAssignments.map((team, index) => {
        const ids = team.player_ids || team.playerIds || [];
        const teamPlayers = ids.map((id) => playerMap.get(id)).filter(Boolean);
        return {
          name: team.name || `Equipo ${String.fromCharCode(65 + index)}`,
          team_order: index + 1,
          target_size: teamPlayers.length,
          players: teamPlayers,
          total_rating: teamPlayers.reduce((s, p) => s + playerEffectiveRating(p), 0),
          goalkeeper_count: teamPlayers.filter((p) => (p.skills || []).includes("goalkeeper") || p.preferred_position === "Goalkeeper").length,
        };
      });
      const flatIds = aiTeams.flatMap((team) => team.players.map((player) => player.id));
      const assignedIds = new Set(flatIds);
      const isValidAi = aiTeams.length > 0
        && flatIds.length === players.length
        && assignedIds.size === players.length
        && players.every((player) => assignedIds.has(player.id))
        && aiTeams.every((team) => team.players.length > 0);
      generated = isValidAi
        ? {
            team_count: aiTeams.length,
            confirmed_player_count: players.length,
            teams: aiTeams,
          }
        : generateBalancedTeams(players, { pins: options.pins });
    } else {
      generated = generateBalancedTeams(players, { pins: options.pins });
    }

    if (penaltyTeam && penaltyTeam.length > 0) {
      generated.teams.push({
        name: "Equipo C",
        team_order: generated.teams.length + 1,
        target_size: penaltyTeam.length,
        players: penaltyTeam,
        total_rating: Math.round(penaltyTeam.reduce((s, p) => s + playerEffectiveRating(p), 0)),
        goalkeeper_count: penaltyTeam.filter((p) => (p.skills || []).includes("goalkeeper") || p.preferred_position === "Goalkeeper").length,
      });
      generated.team_count += 1;
      generated.confirmed_player_count += penaltyTeam.length;
    }

    await client.from("teams").delete().eq("match_id", match.id);

    const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#f97316", "#a855f7", "#1f2937", "#ffffff"];

    const teams = await readMany(
      client
        .from("teams")
        .insert(
          generated.teams.map((team, index) => ({
            match_id: match.id,
            name: team.name,
            team_order: index + 1,
            total_rating: Math.round(team.total_rating || 0),
            color: team.color || TEAM_COLORS[index % TEAM_COLORS.length],
          })),
        )
        .select("*"),
    );

    const teamRowsByOrder = new Map(teams.map((team) => [team.team_order, team]));
    const members = generated.teams.flatMap((team, index) => {
      const teamRow = teamRowsByOrder.get(index + 1);

      return team.players.map((player) => {
        if (player.is_guest) {
          return { team_id: teamRow.id, profile_id: null, guest_player_id: player.id };
        }
        return { team_id: teamRow.id, profile_id: player.id };
      });
    });

    if (members.length > 0) {
      await readMany(client.from("team_members").insert(members).select("*"));
    }

    return {
      ...generated,
      teams: await api.listTeams(match.id),
    };
  },

  async listFines(groupId) {
    const client = requireSupabase();

    return readMany(
      client
        .from("fines")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    );
  },

  async createFine(payload) {
    const client = requireSupabase();

    return readOne(client.from("fines").insert(payload).select("*").single());
  },

  async updateFine(fineId, payload) {
    const client = requireSupabase();

    return readOne(
      client.from("fines").update(payload).eq("id", fineId).select("*").single(),
    );
  },

  async deleteFine(fineId) {
    const client = requireSupabase();

    const { error } = await client.from("fines").delete().eq("id", fineId);
    raise(error);
  },

  async listSettings(groupId) {
    const client = requireSupabase();

    return readMany(
      client.from("settings").select("*").eq("group_id", groupId).limit(1),
    );
  },

  async updateSettings(groupId, payload) {
    const client = requireSupabase();

    return readOne(
      client
        .from("settings")
        .update(payload)
        .eq("group_id", groupId)
        .select("*")
        .single(),
    );
  },

  // ---------------------------------------------------------------------------
  // Venues
  // ---------------------------------------------------------------------------

  async listVenues(groupId) {
    const client = requireSupabase();

    return readMany(
      client
        .from("venues")
        .select("*")
        .eq("group_id", groupId)
        .order("name", { ascending: true }),
    );
  },

  async createVenue(payload) {
    const client = requireSupabase();

    return readOne(
      client.from("venues").insert(payload).select("*").single(),
    );
  },

  async updateVenue(venueId, payload) {
    const client = requireSupabase();

    return readOne(
      client.from("venues").update(payload).eq("id", venueId).select("*").single(),
    );
  },

  async uploadVenuePhoto(venueId, file) {
    const client = requireSupabase();
    const ext = fileExtension(file) || "jpg";
    const path = `${venueId || "misc"}/${Date.now()}.${ext}`;
    const { error } = await client.storage
      .from("venue-photos")
      .upload(path, file, { cacheControl: "3600", contentType: safeContentType(file), upsert: true });

    if (error) {
      if (error.message?.includes("bucket")) {
        throw new Error("Error de almacenamiento: el bucket 'venue-photos' no existe. Pedile al admin que corra la migración de storage.");
      }
      raise(error);
    }

    const { data } = client.storage.from("venue-photos").getPublicUrl(path);
    const venueUrl = (data?.publicUrl || "").replace(/%0A/g, "").trim();

    return readOne(
      client.from("venues").update({ photo_url: venueUrl }).eq("id", venueId).select("*").single(),
    );
  },

  // ---------------------------------------------------------------------------
  // Match fees
  // ---------------------------------------------------------------------------

  async getMatchFee(matchId) {
    const client = requireSupabase();
    const { data } = await client
      .from("match_fees")
      .select("*, match_fee_payments(*)")
      .eq("match_id", matchId)
      .maybeSingle();

    if (!data) return null;
    if (Array.isArray(data.match_fee_payments)) {
      data.match_fee_payments = await hydratePaymentProofUrls(client, data.match_fee_payments);
    }
    return data;
  },

  /**
   * Create or recalculate the match fee whenever a new player confirms.
   * - Creates the match_fee row if it doesn't exist.
   * - Recalculates per_player_amount = total_amount / confirmedCount.
   * - Inserts missing payment rows for new confirmed players.
   * - Updates existing pending rows with the new per_player_amount.
   */
  async upsertMatchFee(matchId, groupId, totalAmount, confirmedProfileIds, dueDate) {
    const client = requireSupabase();

    if (!confirmedProfileIds.length || totalAmount <= 0) return null;

    const perPlayer = Math.ceil(totalAmount / confirmedProfileIds.length);

    // Upsert the fee record
    const fee = await readOne(
      client
        .from("match_fees")
        .upsert(
          {
            match_id: matchId,
            group_id: groupId,
            total_amount: totalAmount,
            per_player_amount: perPlayer,
            due_before: dueDate || null,
            status: "open",
          },
          { onConflict: "match_id" },
        )
        .select("*")
        .single(),
    );

    // Get existing payment rows
    const existing = await readMany(
      client.from("match_fee_payments").select("*").eq("match_fee_id", fee.id),
    );

    const existingProfileIds = new Set(existing.map((p) => p.profile_id));

    // Insert missing rows
    const newRows = confirmedProfileIds
      .filter((id) => !existingProfileIds.has(id))
      .map((profileId) => ({
        match_fee_id: fee.id,
        group_id: groupId,
        profile_id: profileId,
        status: "pending",
      }));

    if (newRows.length > 0) {
      await readMany(
        client.from("match_fee_payments").insert(newRows).select("*"),
      );
    }

    // Update pending rows with new per-player amount (stored on the fee, not each row)
    // per_player_amount is on match_fees, already updated above.

    return api.getMatchFee(matchId);
  },

  async updateMatchFee(feeId, payload) {
    const client = requireSupabase();

    return readOne(
      client
        .from("match_fees")
        .update(payload)
        .eq("id", feeId)
        .select("*")
        .single(),
    );
  },

  async updateMatchFeePayment(paymentId, payload) {
    const client = requireSupabase();

    return readOne(
      client
        .from("match_fee_payments")
        .update({
          ...payload,
          paid_at: payload.status === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", paymentId)
        .select("*")
        .single(),
    );
  },

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------

  async listCollections(groupId) {
    const client = requireSupabase();

    const rows = await readMany(
      client
        .from("collections")
        .select("*, collection_payments(*)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    );

    return Promise.all(
      rows.map(async (col) => ({
        ...col,
        collection_payments: await hydratePaymentProofUrls(client, col.collection_payments || []),
      })),
    );
  },

  async syncCollectionPayments(groupId, activeProfileIds) {
    const client = requireSupabase();

    const openCollections = await readMany(
      client
        .from("collections")
        .select("id")
        .eq("group_id", groupId)
        .eq("status", "open"),
    );

    if (openCollections.length === 0 || activeProfileIds.length === 0) return;

    const existing = await readMany(
      client
        .from("collection_payments")
        .select("collection_id, profile_id")
        .eq("group_id", groupId),
    );

    const existingSet = new Set(
      existing.map((r) => `${r.collection_id}|${r.profile_id}`),
    );

    const missing = [];
    for (const col of openCollections) {
      for (const profileId of activeProfileIds) {
        if (!existingSet.has(`${col.id}|${profileId}`)) {
          missing.push({
            collection_id: col.id,
            group_id: groupId,
            profile_id: profileId,
            status: "pending",
          });
        }
      }
    }

    if (missing.length > 0) {
      await readMany(
        client.from("collection_payments").insert(missing).select("*"),
      );
    }
  },

  /**
   * Create a collection and auto-generate payment rows for all active members.
   */
  async createCollection(payload, activeProfileIds) {
    const client = requireSupabase();

    const collection = await readOne(
      client.from("collections").insert(payload).select("*").single(),
    );

    if (activeProfileIds.length > 0) {
      const rows = activeProfileIds.map((profileId) => ({
        collection_id: collection.id,
        group_id: payload.group_id,
        profile_id: profileId,
        status: "pending",
      }));

      await readMany(
        client.from("collection_payments").insert(rows).select("*"),
      );
    }

    return api.listCollections(payload.group_id).then(
      (cols) => cols.find((c) => c.id === collection.id) || collection,
    );
  },

  async updateCollection(collectionId, payload) {
    const client = requireSupabase();

    return readOne(
      client
        .from("collections")
        .update(payload)
        .eq("id", collectionId)
        .select("*")
        .single(),
    );
  },

  async deleteCollection(collectionId) {
    const client = requireSupabase();

    const { error } = await client
      .from("collections")
      .delete()
      .eq("id", collectionId);

    raise(error);
  },

  async updateCollectionPayment(paymentId, payload) {
    const client = requireSupabase();

    return readOne(
      client
        .from("collection_payments")
        .update({
          ...payload,
          paid_at: payload.status === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", paymentId)
        .select("*")
        .single(),
    );
  },

  // ---------------------------------------------------------------------------
  // Role management (super_admin only)
  // ---------------------------------------------------------------------------

  async updateMemberRole(groupId, profileId, role) {
    const client = requireSupabase();

    return readOne(
      client
        .from("group_members")
        .update({ role })
        .eq("group_id", groupId)
        .eq("profile_id", profileId)
        .select("*, groups(*)")
        .single(),
    );
  },

  async removeGroupMember(groupId, profileId) {
    const client = requireSupabase();
    const { error, count } = await client
      .from("group_members")
      .delete({ count: "exact" })
      .eq("group_id", groupId)
      .eq("profile_id", profileId);

    raise(error);

    if (count === 0) {
      throw new Error(
        "No se pudo remover al jugador. Verificá que tengas permisos de Super Admin en este grupo.",
      );
    }
  },

  async deleteMyAccount(profileId) {
    const client = requireSupabase();
    // Deleting the profile cascades to group_members, attendances, etc.
    // The auth.users row is deleted via Supabase's cascading foreign key.
    const { error } = await client
      .from("profiles")
      .delete()
      .eq("id", profileId);

    raise(error);
    // Sign out after deletion
    await client.auth.signOut();
  },

  // ---------------------------------------------------------------------------
  // Payment proofs (comprobantes de pago) - Simplified version
  // ---------------------------------------------------------------------------

  /**
   * Generate a token for payment proof upload.
   * Simple base64 encoding of payment info.
   */
  async generateProofToken(paymentId, paymentType) {
    const client = requireSupabase();

    // Get payment info
    let paymentData;
    if (paymentType === "match_fee") {
      const { data } = await client
        .from("match_fee_payments")
        .select("id, profile_id, group_id")
        .eq("id", paymentId)
        .single();
      paymentData = data;
    } else {
      const { data } = await client
        .from("collection_payments")
        .select("id, profile_id, group_id")
        .eq("id", paymentId)
        .single();
      paymentData = data;
    }

    if (!paymentData) throw new Error("Pago no encontrado");

    // Create simple token
    const tokenData = {
      pid: paymentId,
      uid: paymentData.profile_id,
      type: paymentType,
      gid: paymentData.group_id,
    };

    return btoa(JSON.stringify(tokenData));
  },

  async generateCollectionProofToken(collectionId) {
    const client = requireSupabase();
    const { data } = await client
      .from("collections")
      .select("id, group_id")
      .eq("id", collectionId)
      .single();

    if (!data) throw new Error("Cobro no encontrado");

    return btoa(JSON.stringify({
      cid: data.id,
      gid: data.group_id,
      type: "collection_group",
    }));
  },

  /**
   * Verify a payment proof token and return payment info.
   */
  async verifyProofToken(token) {
    const client = requireSupabase();

    try {
      const tokenData = JSON.parse(atob(token));
      const { pid: paymentId, uid: profileId, type: paymentType, gid: groupId } = tokenData;

      const { data: authData } = await client.auth.getUser();
      const currentUserId = authData?.user?.id;

      // Si no hay sesión, no podemos consultar la DB debido a RLS.
      // Retornamos de inmediato indicando que se requiere login.
      if (!currentUserId) {
        return {
          valid: true,
          requires_login: true,
          payment_id: paymentId || null,
          profile_id: profileId || null,
          group_id: groupId || (paymentType === "collection_group" ? tokenData.gid : null),
          collection_id: paymentType === "collection_group" ? tokenData.cid : null,
          payment_type: paymentType === "collection_group" ? "collection" : paymentType,
          amount: 0,
          title: "Cargando cobro...",
          proof_status: "pending",
        };
      }

      if (paymentType === "collection_group") {
        const { cid: collectionId } = tokenData;

        const { data: paymentRecord } = await client
          .from("collection_payments")
          .select(`
            id, profile_id, group_id, status, proof_status, proof_url, proof_rejection_reason,
            collections!inner(id, amount_per_player, title, due_date)
          `)
          .eq("collection_id", collectionId)
          .eq("profile_id", currentUserId)
          .single();

        if (!paymentRecord) {
          return { valid: false, error: "No tenés un pago asignado para este cobro." };
        }

        const dueDate = paymentRecord.collections?.due_date;
        if (dueDate) {
          const parsedDue = /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
            ? new Date(dueDate + "T23:59:59")
            : new Date(dueDate);
          if (parsedDue < new Date()) {
            return { valid: false, error: "Este cobro ya venció" };
          }
        }

        return {
          valid: true,
          payment_id: paymentRecord.id,
          profile_id: currentUserId,
          group_id: groupId || paymentRecord.group_id,
          collection_id: collectionId,
          payment_type: "collection",
          payment_status: paymentRecord.status,
          proof_status: paymentRecord.proof_status || "pending",
          proof_url: paymentRecord.proof_url,
          proof_rejection_reason: paymentRecord.proof_rejection_reason,
          amount: paymentRecord.collections?.amount_per_player,
          title: paymentRecord.collections?.title,
        };
      }

      // Get payment details
      let paymentRecord;
      if (paymentType === "match_fee") {
        const { data } = await client
          .from("match_fee_payments")
          .select(`
            id, profile_id, group_id, status, proof_status, proof_url,
            match_fees!inner(per_player_amount, match_id, due_before, matches(title))
          `)
          .eq("id", paymentId)
          .eq("profile_id", profileId)
          .single();
        paymentRecord = data;
      } else {
        const { data } = await client
          .from("collection_payments")
          .select(`
            id, profile_id, group_id, status, proof_status, proof_url,
            collections!inner(amount_per_player, title, due_date)
          `)
          .eq("id", paymentId)
          .eq("profile_id", profileId)
          .single();
        paymentRecord = data;
      }

      if (!paymentRecord) {
        return { valid: false, error: "Pago no encontrado" };
      }

      // Check expiry
      const dueDate = paymentType === "match_fee"
        ? paymentRecord.match_fees?.due_before
        : paymentRecord.collections?.due_date;

      if (dueDate) {
        const parsedDue = /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
          ? new Date(dueDate + "T23:59:59")
          : new Date(dueDate);
        if (parsedDue < new Date()) {
          return { valid: false, error: "Este cobro ya venció" };
        }
      }

      return {
        valid: true,
        payment_id: paymentId,
        profile_id: profileId,
        group_id: groupId,
        payment_type: paymentType,
        payment_status: paymentRecord.status,
        proof_status: paymentRecord.proof_status || "pending",
        proof_url: paymentRecord.proof_url,
        amount: paymentType === "match_fee"
          ? paymentRecord.match_fees?.per_player_amount
          : paymentRecord.collections?.amount_per_player,
        title: paymentType === "match_fee"
          ? paymentRecord.match_fees?.matches?.title
          : paymentRecord.collections?.title,
        match_id: paymentType === "match_fee"
          ? paymentRecord.match_fees?.match_id
          : null,
      };
    } catch (err) {
      return { valid: false, error: "Token inválido" };
    }
  },

  /**
   * Upload payment proof image and update status to 'submitted'.
   */
  async uploadPaymentProof(paymentId, paymentType, file) {
    if (!paymentId) {
      throw new Error("No se puede subir el comprobante: el ID de pago no está asignado. Probá refrescando la página o volviendo a iniciar sesión.");
    }
    const client = requireSupabase();
    const ext = fileExtension(file) || "jpg";
    const path = `${paymentId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await client.storage
      .from("payment-proofs")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: safeContentType(file),
        upsert: true,
      });

    if (uploadError) {
      if (uploadError.message?.includes("bucket")) {
        throw new Error("Error de almacenamiento: el bucket 'payment-proofs' no existe. Pedile al admin que corra la migración de storage.");
      }
      raise(uploadError);
    }

    const { data: urlData } = client.storage
      .from("payment-proofs")
      .getPublicUrl(path);

    const proofUrl = (urlData?.publicUrl || "").replace(/%0A/g, "").trim();

    // Intentar usar la función RPC segura primero
    const { data: result, error: rpcError } = await client.rpc("submit_payment_proof", {
      payment_id: paymentId,
      payment_type: paymentType,
      proof_url: proofUrl,
    });

    if (rpcError) {
      // Fallback si la función RPC no existe
      const table = paymentType === "match_fee" ? "match_fee_payments" : "collection_payments";
      const { data: updatedData, error: updateError } = await client
        .from(table)
        .update({
          proof_url: proofUrl,
          proof_status: "submitted",
          proof_submitted_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .select();

      raise(updateError);

      if (updatedData && updatedData.length === 0) {
        throw new Error("No se pudo actualizar el comprobante. Es posible que no tengas permisos para actualizar este pago o que no exista.");
      }
    } else if (result && !result.success) {
      throw new Error(result.error || "Error al actualizar el estado del pago.");
    }

    return { proofUrl, success: true };
  },

  /**
   * Admin reviews a payment proof (approve or reject).
   */
  async reviewPaymentProof(paymentId, paymentType, status, rejectionReason = null) {
    const client = requireSupabase();
    const table = paymentType === "match_fee" ? "match_fee_payments" : "collection_payments";

    const updateData = {
      proof_status: status,
      proof_reviewed_at: new Date().toISOString(),
      proof_rejection_reason: rejectionReason,
    };

    // If approved, also mark as paid
    if (status === "approved") {
      updateData.status = "paid";
      updateData.paid_at = new Date().toISOString();
    }

    const { error } = await client
      .from(table)
      .update(updateData)
      .eq("id", paymentId);

    raise(error);
    return { success: true };
  },

  // ---------------------------------------------------------------------------
  // Tournaments
  // ---------------------------------------------------------------------------

  async listTournaments(groupId) {
    const client = requireSupabase();
    return readMany(
      client.from("tournaments").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
    );
  },

  async getTournament(tournamentId) {
    const client = requireSupabase();
    return readOne(
      client.from("tournaments").select("*").eq("id", tournamentId).single(),
    );
  },

  async createTournament(payload) {
    const client = requireSupabase();
    return readOne(client.from("tournaments").insert(payload).select("*").single());
  },

  async updateTournament(tournamentId, payload) {
    const client = requireSupabase();
    return readOne(
      client.from("tournaments").update(payload).eq("id", tournamentId).select("*").single(),
    );
  },

  async deleteTournament(tournamentId) {
    const client = requireSupabase();
    const { error } = await client.from("tournaments").delete().eq("id", tournamentId);
    raise(error);
  },

  async createTournamentTeams(tournamentId, teams) {
    const client = requireSupabase();
    return readMany(
      client.from("tournament_teams").insert(teams).select("*"),
    );
  },

  async listTournamentTeams(tournamentId) {
    const client = requireSupabase();
    return readMany(
      client.from("tournament_teams").select("*").eq("tournament_id", tournamentId).order("team_order"),
    );
  },

  async addTournamentTeamMembers(teamId, profileIds) {
    const client = requireSupabase();
    const rows = profileIds.map((pid) => ({ tournament_team_id: teamId, profile_id: pid }));
    return readMany(client.from("tournament_team_members").insert(rows).select("*"));
  },

  async removeTournamentTeamMember(memberId) {
    const client = requireSupabase();
    const { error } = await client.from("tournament_team_members").delete().eq("id", memberId);
    raise(error);
  },

  async listTournamentTeamMembers(tournamentId) {
    const client = requireSupabase();
    return readMany(
      client.from("tournament_team_members")
        .select("*, profiles(*)")
        .eq("tournament_team_id", tournamentId),
    );
  },

  async listAllTournamentTeamMembers(tournamentId) {
    const client = requireSupabase();
    const teams = await readMany(
      client.from("tournament_teams").select("id").eq("tournament_id", tournamentId),
    );
    if (teams.length === 0) return [];
    const teamIds = teams.map((t) => t.id);
    const members = await readMany(
      client.from("tournament_team_members")
        .select("id, tournament_team_id, profile_id, created_at")
        .in("tournament_team_id", teamIds),
    );
    const profileIds = [...new Set(members.map((m) => m.profile_id))];
    if (profileIds.length === 0) return members.map((m) => ({ ...m, profiles: null }));
    const profiles = await readMany(
      client.from("profiles").select("id, full_name, nickname, avatar_url, preferred_position").in("id", profileIds),
    );
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    return members.map((m) => ({ ...m, profiles: profileMap.get(m.profile_id) || null }));
  },

  async createTournamentMatches(matches) {
    const client = requireSupabase();
    // Fixtures are heterogeneous (only playoff rows carry is_playoff / playoff_label / is_final).
    // In a bulk insert PostgREST receives the union of keys; defaultToNull:false makes the
    // missing ones take the column DEFAULT (false) instead of an explicit NULL.
    return readMany(client.from("tournament_matches").insert(matches, { defaultToNull: false }).select("*"));
  },

  async listTournamentMatches(tournamentId) {
    const client = requireSupabase();
    return readMany(
      client.from("tournament_matches")
        .select("*, home_team:tournament_teams!home_team_id(*), away_team:tournament_teams!away_team_id(*)")
        .eq("tournament_id", tournamentId)
        .order("round")
        .order("match_order"),
    );
  },

  async updateTournamentMatch(matchId, payload) {
    const client = requireSupabase();
    return readOne(
      client.from("tournament_matches").update(payload).eq("id", matchId).select("*").single(),
    );
  },

  async initStandings(tournamentId, teamIds) {
    const client = requireSupabase();
    const rows = teamIds.map((tid) => ({ tournament_id: tournamentId, tournament_team_id: tid }));
    return readMany(client.from("tournament_standings").insert(rows).select("*"));
  },

  async listStandings(tournamentId) {
    const client = requireSupabase();
    return readMany(
      client.from("tournament_standings")
        .select("*, tournament_team:tournament_teams(*)")
        .eq("tournament_id", tournamentId)
        .order("points", { ascending: false })
        .order("goals_for", { ascending: false }),
    );
  },

  async updateStanding(standingId, payload) {
    const client = requireSupabase();
    return readOne(
      client.from("tournament_standings").update(payload).eq("id", standingId).select("*").single(),
    );
  },

  async upsertMatchStat(payload) {
    const client = requireSupabase();
    return readOne(
      client.from("match_stats").upsert(payload, { onConflict: "match_id,profile_id" }).select("*").single(),
    );
  },

  async listMatchStats(matchId) {
    const client = requireSupabase();
    return readMany(
      client.from("match_stats").select("*, profiles(*)").eq("match_id", matchId),
    );
  },

  async getPlayerStats(groupId) {
    const client = requireSupabase();
    const { data, error } = await client.rpc("get_player_stats", { p_group_id: groupId }).maybeSingle();
    if (error) return [];
    return data || [];
  },

  async listRecurringMatches(groupId) {
    const client = requireSupabase();
    return readMany(
      client.from("recurring_matches").select("*").eq("group_id", groupId),
    );
  },

  async createRecurringMatch(payload) {
    const client = requireSupabase();
    return readOne(client.from("recurring_matches").insert(payload).select("*").single());
  },

  async updateRecurringMatch(id, payload) {
    const client = requireSupabase();
    return readOne(
      client.from("recurring_matches").update(payload).eq("id", id).select("*").single(),
    );
  },
  async generateRecurringMatch(recurring) {
    const client = requireSupabase();
    const dateStr = nextOccurrenceStr(recurring.day_of_week);
    // Idempotente: si ya existe un partido para esta recurrencia en esa fecha, no duplicar.
    if (await matchExistsOnDate(recurring.group_id, dateStr, recurring.match_time, recurring.venue, recurring.title)) {
      await client.from("recurring_matches").update({ last_generated_date: dateStr }).eq("id", recurring.id);
      return null;
    }
    const match = await readOne(
      client.from("matches").insert({
        group_id: recurring.group_id,
        title: recurring.title,
        match_date: dateStr,
        start_time: recurring.match_time,
        venue: recurring.venue,
        min_players: recurring.min_players,
        max_players: recurring.max_players,
        status: "upcoming",
      }).select("*").single(),
    );
    await client.from("recurring_matches").update({ last_generated_date: dateStr }).eq("id", recurring.id);
    return match;
  },

  /** Genera los próximos partidos de todas las recurrencias activas del grupo dentro de un horizonte
   *  (semanas). Nunca crea duplicados si se ejecuta más de una vez. Cada partido generado es una fila
   *  independiente de `matches`, así que editar o cancelar un encuentro no afecta a la serie ni a las
   *  demás recurrencias. No confirma asistencia de nadie (cada jugador confirma por su cuenta). */
  async generateUpcomingRecurringMatches(groupId, horizonWeeks = 4) {
    const client = requireSupabase();
    const [recurrings, existing] = await Promise.all([
      client.from("recurring_matches").select("*").eq("group_id", groupId),
      client
        .from("matches")
        .select("id, match_date, start_time, venue, title")
        .eq("group_id", groupId)
        .gte("match_date", todayStr()),
    ]);
    const active = (recurrings || []).filter((r) => r.is_active);
    const nowRef = new Date();
    const horizonEnd = addWeeksStr(nowRef, horizonWeeks);
    let generated = 0;
    let skipped = 0;
    for (const r of active) {
      let dateStr = nextOccurrenceStr(r.day_of_week, nowRef);
      while (dateStr <= horizonEnd) {
        const dup = (existing || []).some(
          (m) =>
            m.match_date === dateStr &&
            (m.start_time || "") === (r.match_time || "") &&
            (m.venue || "") === (r.venue || "") &&
            (m.title || "") === (r.title || ""),
        );
        if (dup) {
          skipped += 1;
        } else {
          await client.from("matches").insert({
            group_id: r.group_id,
            title: r.title,
            match_date: dateStr,
            start_time: r.match_time,
            venue: r.venue,
            min_players: r.min_players,
            max_players: r.max_players,
            status: "upcoming",
          });
          generated += 1;
        }
        dateStr = addWeeksStr(dateStr, 1);
      }
      await client.from("recurring_matches").update({ last_generated_date: horizonEnd }).eq("id", r.id);
    }
    return { generated, skipped, horizonEnd };
  },

  async deleteRecurringMatch(id) {
    const client = requireSupabase();
    const { error, count } = await client
      .from("recurring_matches")
      .delete({ count: "exact" })
      .eq("id", id);
    raise(error);
    if (count === 0) {
      throw new Error("No se pudo eliminar la recurrencia. Verificá tus permisos.");
    }
  },

  // ---------------------------------------------------------------------------
  // Player Votes
  // ---------------------------------------------------------------------------

  async votePlayer(groupId, voterId, votedId, vote) {
    const client = requireSupabase();
    return readOne(
      client.from("player_votes").upsert(
        { group_id: groupId, voter_id: voterId, voted_id: votedId, vote },
        { onConflict: "group_id,voter_id,voted_id" },
      ).select("*").single(),
    );
  },

  async removeVote(groupId, voterId, votedId) {
    const client = requireSupabase();
    const { error } = await client.from("player_votes")
      .delete()
      .eq("group_id", groupId)
      .eq("voter_id", voterId)
      .eq("voted_id", votedId);
    raise(error);
  },

  async getPlayerVotes(groupId) {
    const client = requireSupabase();
    return readMany(
      client.from("player_votes")
        .select("id, voter_id, voted_id, vote")
        .eq("group_id", groupId),
    );
  },

  async listPlayerSkills(groupId) {
    const client = requireSupabase();
    return readMany(
      client.from("player_skills")
        .select("*")
        .eq("group_id", groupId),
    );
  },

  async addPlayerSkill(groupId, playerId, skill, adminId) {
    const client = requireSupabase();
    return readOne(
      client.from("player_skills").upsert(
        { group_id: groupId, player_id: playerId, skill, assigned_by: adminId },
        { onConflict: "group_id,player_id,skill" },
      ).select("*").single(),
    );
  },

  async removePlayerSkill(skillId) {
    const client = requireSupabase();
    const { error } = await client.from("player_skills").delete().eq("id", skillId);
    raise(error);
  },

  // ---------------------------------------------------------------------------
  // Guest Players (temporary, match-only)
  // ---------------------------------------------------------------------------

  async listGuestPlayers(matchId) {
    const client = requireSupabase();
    return readMany(
      client.from("guest_players").select("*").eq("match_id", matchId).order("created_at"),
    );
  },

  async listGroupGuestPlayers(groupId) {
    const client = requireSupabase();
    return readMany(
      client.from("guest_players").select("*").eq("group_id", groupId),
    );
  },

  async addGuestPlayer(matchId, groupId, name, rating, adminId) {
    const client = requireSupabase();
    return readOne(
      client.from("guest_players").insert({
        match_id: matchId,
        group_id: groupId,
        name,
        rating: Math.max(1, Math.min(4, rating)),
        assigned_by: adminId,
      }).select("*").single(),
    );
  },

  async updateGuestPlayer(guestId, payload) {
    const client = requireSupabase();
    return readOne(
      client.from("guest_players").update(payload).eq("id", guestId).select("*").single(),
    );
  },

  async deleteGuestPlayer(guestId) {
    const client = requireSupabase();
    const { error } = await client.from("guest_players").delete().eq("id", guestId);
    raise(error);
  },

  async getMatch(matchId) {
    const client = requireSupabase();
    return readOne(
      client.from("matches").select("id, title, match_date, start_time, venue").eq("id", matchId).single(),
    );
  },

  generateGuestLink(matchId) {
    const origin = typeof window === "undefined"
      ? "https://f5manager.lat"
      : window.location.origin;
    const token = matchId.replace(/-/g, "");
    return `${origin}/guest/${token}`;
  },

  async getPublicMatchForGuest(token) {
    const client = requireSupabase();
    const rows = await readMany(
      client.rpc("get_public_match_for_guest", { p_token: token }),
    );
    return rows[0] || null;
  },

  async registerGuest(token, name) {
    const client = requireSupabase();
    const rows = await readMany(
      client.rpc("register_guest_for_match", { p_token: token, p_name: name }),
    );
    if (!rows[0]) throw new Error("Error al registrarse como invitado.");
    return rows[0];
  },

  async getPublicReservationsByTokens(tokens = []) {
    const client = requireSupabase();
    return readMany(
      client.rpc("get_public_reservations_by_tokens", { p_tokens: tokens }),
    );
  },

  async submitReservationProofByToken(token, proofUrl) {
    const client = requireSupabase();
    const rows = await readMany(
      client.rpc("submit_reservation_proof_by_token", {
        p_token: token,
        p_proof_url: proofUrl,
      }),
    );
    return rows[0] || null;
  },

  // ---------------------------------------------------------------------------
  // Court Reservations
  // ---------------------------------------------------------------------------

  async listReservations(groupId) {
    const client = requireSupabase();
    const reservations = await readMany(
      client.from("court_reservations")
        .select("*")
        .eq("group_id", groupId)
        .order("reservation_date"),
    );

    const profileIds = [...new Set(
      reservations.flatMap((r) => [r.assigned_to, r.assigned_by]).filter(Boolean),
    )];

    if (profileIds.length > 0) {
      const profiles = await readMany(
        client.from("profiles").select("id, full_name, nickname, avatar_url").in("id", profileIds),
      );
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      reservations.forEach((r) => {
        r.assigned_profile = profileMap.get(r.assigned_to) || null;
        r.assigned_by_profile = profileMap.get(r.assigned_by) || null;
      });
    }

    return reservations;
  },

  async createReservation(payload) {
    const client = requireSupabase();
    return readOne(client.from("court_reservations").insert(payload).select("*").single());
  },

  async updateReservation(reservationId, payload) {
    const client = requireSupabase();
    return readOne(
      client.from("court_reservations").update(payload).eq("id", reservationId).select("*").single(),
    );
  },

  async deleteReservation(reservationId) {
    const client = requireSupabase();
    const { error } = await client.from("court_reservations").delete().eq("id", reservationId);
    raise(error);
  },

  async uploadReservationProof(reservationId, file) {
    const client = requireSupabase();
    const ext = fileExtension(file) || "jpg";
    const path = `${reservationId}/${Date.now()}.${ext}`;
    const { error } = await client.storage
      .from("reservation-proofs")
      .upload(path, file, { cacheControl: "3600", contentType: safeContentType(file), upsert: true });

    if (error) {
      if (error.message?.includes("bucket")) {
        throw new Error("El bucket 'reservation-proofs' no existe. Crealo en Supabase Storage o corré la migración de storage.");
      }
      throw new Error(`Error subiendo comprobante: ${error.message}`);
    }

    const { data: urlData } = client.storage.from("reservation-proofs").getPublicUrl(path);
    return (urlData?.publicUrl || "").replace(/%0A/g, "").trim();
  },

  async confirmReservation(reservationId, groupId, venue, date, time, title) {
    const client = requireSupabase();

    // 1. Fetch reservation details to extract tags from notes
    const { data: resData } = await client.from("court_reservations")
      .select("notes")
      .eq("id", reservationId)
      .single();

    let allowedTags = [];
    let cleanTitle = title || `Partido en ${venue}`;

    if (resData?.notes) {
      const matchTags = resData.notes.match(/^\[Tags:\s*([^\]]*)\]\s*(.*)/);
      if (matchTags) {
        const tagStr = matchTags[1];
        allowedTags = tagStr.split(",").map((t) => t.trim()).filter(Boolean);
        const restNotes = matchTags[2];
        if (restNotes) {
          cleanTitle = restNotes;
        }
      }
    }

    const match = await readOne(
      client.from("matches").insert({
        group_id: groupId,
        title: cleanTitle,
        match_date: date,
        start_time: time || "19:00",
        venue,
        status: "upcoming",
        allowed_tags: allowedTags,
      }).select("*").single(),
    );

    await client.from("court_reservations")
      .update({ status: "confirmed", match_id: match.id })
      .eq("id", reservationId);

    return match;
  },

  latestRatingsByProfile,

  async savePushSubscription(subscription) {
    const client = requireSupabase();
    return client.from("push_subscriptions").upsert(subscription, {
      onConflict: "profile_id,endpoint",
    });
  },

  async removePushSubscription(profileId, endpoint) {
    const client = requireSupabase();
    return client
      .from("push_subscriptions")
      .delete()
      .eq("profile_id", profileId)
      .eq("endpoint", endpoint);
  },

  async listPushSubscriptions(profileIds = []) {
    const client = requireSupabase();
    let query = client.from("push_subscriptions").select("*");
    if (profileIds.length > 0) {
      query = query.in("profile_id", profileIds);
    }
    return readMany(query);
  },

  // Match Stats API
  // ---------------------------------------------------------------------------
  // Player Evolution: self-declared style (never the official rating)
  // ---------------------------------------------------------------------------
  async listPlayerStyles(profileIds = []) {
    const client = requireSupabase();
    if (!profileIds.length) return [];
    return readMany(client.from("player_styles").select("*").in("profile_id", profileIds));
  },

  async savePlayerStyle(profileId, style) {
    const client = requireSupabase();
    const row = {
      profile_id: profileId,
      secondary_position: style.secondary_position || null,
      attack: style.attack, defense: style.defense, passing: style.passing, pace: style.pace, goalkeeping: style.goalkeeping,
    };
    return readOne(client.from("player_styles").upsert(row, { onConflict: "profile_id" }).select("*").single());
  },

  // ---------------------------------------------------------------------------
  // Postmatch: events (provisional/confirmed), corrections, history, MVP
  // ---------------------------------------------------------------------------
  async postmatchSummary(matchId) {
    return readOne(requireSupabase().rpc("postmatch_summary", { p_match_id: matchId }));
  },
  async postmatchReport(matchId, subjectId, kind, quantity) {
    return readOne(requireSupabase().rpc("postmatch_report", { p_match_id: matchId, p_subject_id: subjectId, p_kind: kind, p_quantity: quantity }));
  },
  async postmatchDecide(eventId, confirm) {
    return readOne(requireSupabase().rpc("postmatch_decide", { p_event_id: eventId, p_confirm: !!confirm }));
  },
  async postmatchRequestCorrection(matchId, eventId, message, proposed) {
    return readOne(requireSupabase().rpc("postmatch_request_correction", {
      p_match_id: matchId, p_event_id: eventId || null, p_message: message, p_proposed: proposed ?? null,
    }));
  },
  async postmatchResolveCorrection(correctionId, accept, note) {
    return readOne(requireSupabase().rpc("postmatch_resolve_correction", { p_correction_id: correctionId, p_accept: !!accept, p_note: note || null }));
  },
  async postmatchVoteMvp(matchId, votedId) {
    return readOne(requireSupabase().rpc("postmatch_vote_mvp", { p_match_id: matchId, p_voted_id: votedId }));
  },
  async postmatchSetValidator(matchId, validatorId) {
    return readOne(requireSupabase().rpc("postmatch_set_validator", { p_match_id: matchId, p_validator_id: validatorId }));
  },
  async postmatchRevokeValidator(matchId) {
    return readOne(requireSupabase().rpc("postmatch_revoke_validator", { p_match_id: matchId }));
  },
  async postmatchClose(matchId) {
    return readOne(requireSupabase().rpc("postmatch_close", { p_match_id: matchId }));
  },
  async listPostmatchClosures(groupId) {
    return readMany(requireSupabase().from("match_postmatch").select("match_id, mvp_profile_id, mvp_votes, voters, participants, closed_at").eq("group_id", groupId));
  },

  async listGroupMatchPlayerStats(groupId) {
    const client = requireSupabase();
    return readMany(
      client.from("match_player_stats").select("*").eq("group_id", groupId)
    );
  },

  async saveMatchPlayerStats(matchId, groupId, statsArray, adminId) {
    const client = requireSupabase();
    // Delete existing stats for the match to prevent conflicts
    await client.from("match_player_stats").delete().eq("match_id", matchId);
    
    if (statsArray.length === 0) return [];
    
    // Insert new stats array
    const rowsToInsert = statsArray.map(stat => ({
      group_id: groupId,
      match_id: matchId,
      player_id: stat.player_id || null,
      guest_player_id: stat.guest_player_id || null,
      goals: stat.goals || 0,
      assists: stat.assists || 0,
      mvp: stat.mvp || false,
      clean_sheet: stat.clean_sheet || false,
      created_by: adminId
    }));
    
    return readMany(
      client.from("match_player_stats").insert(rowsToInsert).select("*")
    );
  },

  async saveSinglePlayerMatchStats(matchId, groupId, playerId, stats, userId) {
    const client = requireSupabase();
    const row = {
      group_id: groupId,
      match_id: matchId,
      player_id: playerId,
      goals: Number(stats.goals || 0),
      assists: Number(stats.assists || 0),
      mvp: Boolean(stats.mvp || false),
      clean_sheet: Boolean(stats.clean_sheet || false),
      created_by: userId
    };
    return readOne(
      client.from("match_player_stats").upsert(row, { onConflict: "match_id,player_id" }).select("*")
    );
  },

  // Group Expenses API
  async listGroupExpenses(groupId) {
    const client = requireSupabase();
    return readMany(
      client.from("group_expenses").select("*").eq("group_id", groupId).order("expense_date", { ascending: false })
    );
  },

  async addGroupExpense(groupId, description, amount, category, expenseDate, adminId) {
    const client = requireSupabase();
    return readOne(
      client.from("group_expenses").insert({
        group_id: groupId,
        description,
        amount,
        category,
        expense_date: expenseDate || new Date().toISOString().split("T")[0],
        created_by: adminId
      }).select("*").single()
    );
  },

  async deleteGroupExpense(expenseId) {
    const client = requireSupabase();
    const { error } = await client.from("group_expenses").delete().eq("id", expenseId);
    raise(error);
  },

  // ── F5 Radar (MVP 1.0) ─────────────────────────────────────────────────────
  // Outsiders only ever use the radar_* RPCs, which return fixed safe columns.
  // Group admins also read radar_group_settings / radar_listings directly (member RLS).

  async getRadarGroupSettings(groupId) {
    const client = requireSupabase();
    const rows = await readMany(client.from("radar_group_settings").select("*").eq("group_id", groupId).limit(1));
    return rows[0] || { group_id: groupId, enabled: false, show_group_name: false };
  },

  async setRadarGroupSettings(groupId, enabled, showGroupName) {
    return readOne(requireSupabase().rpc("radar_set_group_settings", {
      p_group_id: groupId, p_enabled: !!enabled, p_show_group_name: !!showGroupName,
    }));
  },

  async getRadarListingForMatch(matchId) {
    const client = requireSupabase();
    const rows = await readMany(client.from("radar_listings").select("*").eq("match_id", matchId).limit(1));
    return rows[0] || null;
  },

  async listRadarListings(groupId) {
    const client = requireSupabase();
    return readMany(client.from("radar_listings").select("id, match_id, status, radar_slots").eq("group_id", groupId));
  },

  async publishRadarMatch(matchId, { radarSlots, levelBand = "any", positions = [], note = "", zoneLabel = "", closeAt = null }) {
    return readOne(requireSupabase().rpc("radar_publish_match", {
      p_match_id: matchId, p_radar_slots: Number(radarSlots), p_level_band: levelBand, p_positions: positions,
      p_note: note || null, p_zone_label: zoneLabel || null, p_close_at: closeAt || null,
    }));
  },

  async setRadarListingStatus(listingId, status) {
    return readOne(requireSupabase().rpc("radar_set_listing_status", { p_listing_id: listingId, p_status: status }));
  },

  async radarNearby({ lat = null, lng = null, radiusKm = 10, from = null, to = null, level = null, zone = null } = {}) {
    // Coordinates are rounded on the device (≈1 km) before they leave it; the server rounds again.
    const round = (v) => (v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
    return readMany(requireSupabase().rpc("radar_nearby", {
      p_lat: round(lat), p_lng: round(lng), p_radius_km: radiusKm, p_from: from, p_to: to,
      p_level: level || null, p_zone: zone || null,
    }));
  },

  async radarZones() {
    return readMany(requireSupabase().rpc("radar_zones"));
  },

  async radarListingCard(listingId) {
    return readOne(requireSupabase().rpc("radar_listing_card", { p_listing_id: listingId }));
  },

  async radarRequestSpot(listingId, position, message) {
    return readOne(requireSupabase().rpc("radar_request_spot", {
      p_listing_id: listingId, p_position: position || null, p_message: message || null,
    }));
  },

  async radarWithdrawRequest(requestId) {
    return readOne(requireSupabase().rpc("radar_withdraw_request", { p_request_id: requestId }));
  },

  async radarCancelSpot(requestId) {
    return readOne(requireSupabase().rpc("radar_cancel_spot", { p_request_id: requestId }));
  },

  async radarMyRequests() {
    const data = await readOne(requireSupabase().rpc("radar_my_requests"));
    return Array.isArray(data) ? data : [];
  },

  async radarMatchPeople(listingId) {
    return readMany(requireSupabase().rpc("radar_match_people", { p_listing_id: listingId }));
  },

  async radarAdminRequests(matchId) {
    return readMany(requireSupabase().rpc("radar_admin_requests", { p_match_id: matchId }));
  },

  async radarDecideRequest(requestId, approve, note) {
    return readOne(requireSupabase().rpc("radar_decide_request", {
      p_request_id: requestId, p_approve: !!approve, p_note: note || null,
    }));
  },

  async radarBanRequester(requestId) {
    return readOne(requireSupabase().rpc("radar_ban_requester", { p_request_id: requestId }));
  },

  async radarGroupBans(groupId) {
    return readMany(requireSupabase().rpc("radar_group_bans_list", { p_group_id: groupId }));
  },

  async radarUnban(groupId, profileId) {
    return readOne(requireSupabase().rpc("radar_unban", { p_group_id: groupId, p_profile_id: profileId }));
  },

  async radarGroupOutsiders(groupId) {
    return readMany(requireSupabase().rpc("radar_group_outsiders", { p_group_id: groupId }));
  },

  async listNotifications(limit = 30) {
    const client = requireSupabase();
    return readMany(
      client.from("app_notifications").select("*").order("created_at", { ascending: false }).limit(limit),
    );
  },

  async countUnreadNotifications() {
    const client = requireSupabase();
    const { count, error } = await client
      .from("app_notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    raise(error);
    return count || 0;
  },

  async markNotificationsRead(ids = null) {
    return readOne(requireSupabase().rpc("notifications_mark_read", { p_ids: ids && ids.length ? ids : null }));
  },
};
