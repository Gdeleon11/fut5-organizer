import { supabase } from "./supabaseClient.js";
import { generateBalancedTeams } from "./teamGeneration.js";

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

    return readOne(
      client
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
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
    const url = urlData?.publicUrl;
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
          "id, group_id, profile_id, role, is_active, created_at, profiles(id, full_name, nickname, phone, preferred_position, avatar_url, created_at, updated_at)",
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

    return readOne(
      client
        .from("profiles")
        .update(allowedPayload)
        .eq("id", profileId)
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

    return readMany(
      client
        .from("teams")
        .select(
          "*, team_members(*, profiles(id, full_name, nickname, preferred_position, avatar_url))",
        )
        .eq("match_id", matchId)
        .order("team_order", { ascending: true }),
    );
  },

  async listAllTeams(matches = []) {
    const pairs = await Promise.all(
      matches.map(async (match) => [match.id, await api.listTeams(match.id)]),
    );

    return Object.fromEntries(pairs);
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

    let penaltyTeam = null;

    if (options.penaltyTeam && players.length >= 13 && players.length <= 14) {
      const sortedByRating = [...players].sort((a, b) => b.rating - a.rating);
      const topTen = sortedByRating.slice(0, 10);
      const rest = sortedByRating.slice(10);
      penaltyTeam = rest;
      players = topTen;
    }

    const generated = generateBalancedTeams(players);

    if (penaltyTeam && penaltyTeam.length > 0) {
      generated.teams.push({
        name: "Equipo de castigo",
        team_order: generated.teams.length + 1,
        target_size: penaltyTeam.length,
        players: penaltyTeam,
        total_rating: Math.round(penaltyTeam.reduce((s, p) => s + p.rating, 0)),
        goalkeeper_count: penaltyTeam.filter((p) => p.preferred_position === "Goalkeeper").length,
      });
      generated.team_count += 1;
      generated.confirmed_player_count += penaltyTeam.length;
    }

    await client.from("teams").delete().eq("match_id", match.id);

    const teams = await readMany(
      client
        .from("teams")
        .insert(
          generated.teams.map((team, index) => ({
            match_id: match.id,
            name: team.name,
            team_order: index + 1,
            total_rating: Math.round(team.total_rating || 0),
          })),
        )
        .select("*"),
    );

    const teamRowsByOrder = new Map(teams.map((team) => [team.team_order, team]));
    const members = generated.teams.flatMap((team, index) => {
      const teamRow = teamRowsByOrder.get(index + 1);

      return team.players.map((player) => ({
        team_id: teamRow.id,
        profile_id: player.id,
      }));
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

    return readOne(
      client.from("venues").update({ photo_url: data.publicUrl }).eq("id", venueId).select("*").single(),
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

    return data || null;
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

    return readMany(
      client
        .from("collections")
        .select("*, collection_payments(*)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
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

  /**
   * Verify a payment proof token and return payment info.
   */
  async verifyProofToken(token) {
    const client = requireSupabase();

    try {
      const tokenData = JSON.parse(atob(token));
      const { pid: paymentId, uid: profileId, type: paymentType, gid: groupId } = tokenData;

      // Get payment details
      let paymentRecord;
      if (paymentType === "match_fee") {
        const { data } = await client
          .from("match_fee_payments")
          .select(`
            id, profile_id, group_id, status, proof_status, proof_url,
            match_fees!inner(per_player_amount, match_id, due_before),
            matches!inner(title)
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

      if (dueDate && new Date(dueDate) < new Date()) {
        return { valid: false, error: "Este cobro ya venció" };
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
          ? paymentRecord.matches?.title
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
    const client = requireSupabase();
    const ext = fileExtension(file) || "jpg";
    const path = `${paymentId || "misc"}/${Date.now()}.${ext}`;

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

    const proofUrl = urlData.publicUrl;

    // Update payment record directly
    const table = paymentType === "match_fee" ? "match_fee_payments" : "collection_payments";
    const { error: updateError } = await client
      .from(table)
      .update({
        proof_url: proofUrl,
        proof_status: "submitted",
        proof_submitted_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    raise(updateError);

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
    return readMany(client.from("tournament_matches").insert(matches).select("*"));
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
    const nextDate = new Date();
    const dayMap = { 0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday" };
    const targetDay = recurring.day_of_week;
    const diff = ((targetDay - nextDate.getDay()) % 7 + 7) % 7 || 7;
    nextDate.setDate(nextDate.getDate() + diff);
    const dateStr = nextDate.toISOString().split("T")[0];

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

  latestRatingsByProfile,
};
