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
    .slice(0, 80) || "avatar";
}

function fileExtension(file, fallback = "jpg") {
  const cleanedName = safeFileName(file.name || fallback);
  const mimeExtension = file.type?.split("/").pop()?.replace("jpeg", "jpg");

  return cleanedName.includes(".")
    ? cleanedName.split(".").pop()
    : mimeExtension || fallback;
}

function latestRatingsByProfile(ratings = []) {
  const latest = new Map();

  [...ratings]
    .sort((first, second) => new Date(first.created_at) - new Date(second.created_at))
    .forEach((rating) => {
      latest.set(rating.profile_id, rating.rating);
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
    const path = `${profileId}/${Date.now()}.${fileExtension(file)}`;
    const { error } = await client.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    raise(error);

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
    const path = `${matchId}/${Date.now()}.${fileExtension(file)}`;
    const { error } = await client.storage
      .from("match-photos")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    raise(error);

    const { data } = client.storage.from("match-photos").getPublicUrl(path);

    return readOne(
      client
        .from("matches")
        .update({ court_photo_url: data.publicUrl })
        .eq("id", matchId)
        .select("*")
        .single(),
    );
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

  async assignRating(groupId, profileId, rating, adminProfileId) {
    const client = requireSupabase();

    return readOne(
      client
        .from("player_ratings")
        .insert({
          group_id: groupId,
          profile_id: profileId,
          rating,
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

  async generateTeamsForMatch(match, profiles, attendances, ratings) {
    const client = requireSupabase();
    const confirmedIds = attendances
      .filter(
        (attendance) =>
          attendance.match_id === match.id &&
          ["confirmed", "checked_in"].includes(attendance.status),
      )
      .map((attendance) => attendance.profile_id);
    const ratingMap = latestRatingsByProfile(ratings);
    const players = profiles
      .filter(
        (profile) =>
          profile.membership_is_active && confirmedIds.includes(profile.id),
      )
      .map((profile) => ({
        ...profile,
        rating: ratingMap.get(profile.id) || 2,
      }));
    const generated = generateBalancedTeams(players);

    await client.from("teams").delete().eq("match_id", match.id);

    const teams = await readMany(
      client
        .from("teams")
        .insert(
          generated.teams.map((team, index) => ({
            match_id: match.id,
            name: team.name,
            team_order: index + 1,
            total_rating: team.total_rating,
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
    const path = `${venueId}/${Date.now()}.${fileExtension(file)}`;
    const { error } = await client.storage
      .from("venue-photos")
      .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: true });

    raise(error);

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
  // Payment proofs (comprobantes de pago)
  // ---------------------------------------------------------------------------

  /**
   * Generate a token for payment proof upload.
   * Token contains payment_id, profile_id, payment_type, and expiry.
   */
  async generateProofToken(paymentId, paymentType) {
    const client = requireSupabase();

    const { data, error } = await client.rpc("generate_proof_token", {
      payment_id: paymentId,
      payment_type: paymentType,
    });

    raise(error);
    return data;
  },

  /**
   * Verify a payment proof token and return payment info.
   */
  async verifyProofToken(token) {
    const client = requireSupabase();

    const { data, error } = await client.rpc("verify_proof_token", {
      token: token,
    });

    raise(error);
    return data;
  },

  /**
   * Upload payment proof image and update status to 'submitted'.
   */
  async uploadPaymentProof(paymentId, paymentType, file) {
    const client = requireSupabase();
    const path = `${paymentId}/${Date.now()}.${fileExtension(file)}`;

    // Upload image to storage
    const { error: uploadError } = await client.storage
      .from("payment-proofs")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    raise(uploadError);

    // Get public URL
    const { data: urlData } = client.storage
      .from("payment-proofs")
      .getPublicUrl(path);

    const proofUrl = urlData.publicUrl;

    // Update payment record
    const { error: updateError } = await client.rpc("submit_payment_proof", {
      payment_id: paymentId,
      payment_type: paymentType,
      proof_url: proofUrl,
    });

    raise(updateError);

    return { proofUrl, success: true };
  },

  /**
   * Admin reviews a payment proof (approve or reject).
   */
  async reviewPaymentProof(paymentId, paymentType, status, rejectionReason = null) {
    const client = requireSupabase();

    const { data, error } = await client.rpc("review_payment_proof", {
      payment_id: paymentId,
      payment_type: paymentType,
      new_status: status,
      rejection_reason: rejectionReason,
    });

    raise(error);
    return data;
  },

  /**
   * Get payment proof details for admin view.
   */
  async getPaymentProofDetails(paymentId, paymentType) {
    const client = requireSupabase();

    let query;
    if (paymentType === "match_fee") {
      query = client
        .from("match_fee_payments")
        .select(`
          id, proof_url, proof_status, proof_submitted_at, proof_reviewed_at,
          proof_rejection_reason, status, profile_id,
          profiles!inner(id, full_name, nickname, avatar_url)
        `)
        .eq("id", paymentId)
        .single();
    } else {
      query = client
        .from("collection_payments")
        .select(`
          id, proof_url, proof_status, proof_submitted_at, proof_reviewed_at,
          proof_rejection_reason, status, profile_id,
          profiles!inner(id, full_name, nickname, avatar_url)
        `)
        .eq("id", paymentId)
        .single();
    }

    return readOne(query);
  },

  latestRatingsByProfile,
};
