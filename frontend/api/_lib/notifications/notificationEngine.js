import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "./pushSender.js";
import {
  NOTIFICATION_TYPES,
  CHANNELS,
  buildDedupeKey,
  buildNotificationPayload,
} from "./notificationTypes.js";

export const PROCESSING_LEASE_MINUTES = 15;
export const MAX_ATTEMPTS = 3;

/**
 * Returns a Supabase client initialized with server-side service role key.
 * Fails closed if SUPABASE_SERVICE_ROLE_KEY is missing.
 */
export function getSupabaseServerClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server misconfigured: SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL are required for server-side notification engine execution");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Parses match date and time in Guatemala timezone (UTC-6) and returns a Date instance.
 *
 * @param {string} matchDate - Date string "YYYY-MM-DD"
 * @param {string} [startTime="19:00"] - Time string "HH:MM"
 * @returns {Date} JavaScript Date object for the match kickoff
 */
export function getMatchDateTimeGuatemala(matchDate, startTime = "19:00") {
  if (!matchDate) return new Date(NaN);
  const cleanTime = (startTime || "19:00").substring(0, 5);
  // Guatemala is UTC-6
  const isoString = `${matchDate}T${cleanTime}:00-06:00`;
  return new Date(isoString);
}

/**
 * Evaluates whether a match falls into any active reminder time windows.
 *
 * @param {Date} matchDateTime - Match Date object
 * @param {Date} [nowDate=new Date()] - Current Date object
 * @returns {Array<string>} List of applicable notification type constants
 */
export function getApplicableReminderTypes(matchDateTime, nowDate = new Date()) {
  if (isNaN(matchDateTime.getTime())) return [];

  const diffMinutes = (matchDateTime.getTime() - nowDate.getTime()) / (1000 * 60);
  const reminderTypes = [];

  // 24 Hours Window: 1410 min (23h 30m) to 1470 min (24h 30m)
  if (diffMinutes >= 1410 && diffMinutes <= 1470) {
    reminderTypes.push(NOTIFICATION_TYPES.MATCH_REMINDER_24H);
  }

  // 1 Hour Window: 45 min to 75 min
  if (diffMinutes >= 45 && diffMinutes <= 75) {
    reminderTypes.push(NOTIFICATION_TYPES.MATCH_REMINDER_1H);
  }

  return reminderTypes;
}

/**
 * Atomically claims a notification delivery lock using Compare-And-Set (CAS) idempotency.
 *
 * @param {Object} supabase - Supabase client
 * @param {Object} params
 * @param {string} params.profileId
 * @param {string} [params.groupId]
 * @param {string} [params.matchId]
 * @param {string} params.notificationType
 * @param {string} [params.channel="push"]
 * @param {string} params.dedupeKey
 * @param {Date} [params.nowDate=new Date()]
 * @returns {Promise<Object>} { claimed: boolean, deliveryId?, attemptCount?, reason? }
 */
export async function claimNotificationDelivery(supabase, params) {
  const {
    profileId,
    groupId = null,
    matchId = null,
    notificationType,
    channel = CHANNELS.PUSH,
    dedupeKey,
    nowDate = new Date(),
  } = params;

  const nowIso = nowDate.toISOString();

  // Step 1: Try initial INSERT with status='processing'
  const { data: newRow, error: insertError } = await supabase
    .from("notification_deliveries")
    .insert({
      profile_id: profileId,
      group_id: groupId,
      match_id: matchId,
      notification_type: notificationType,
      channel,
      dedupe_key: dedupeKey,
      status: "processing",
      attempt_count: 1,
      last_attempt_at: nowIso,
    })
    .select("id, attempt_count")
    .maybeSingle();

  if (newRow && !insertError) {
    return {
      claimed: true,
      deliveryId: newRow.id,
      attemptCount: 1,
      isNew: true,
    };
  }

  // Step 2: Handle unique constraint collision (already exists)
  const { data: existing } = await supabase
    .from("notification_deliveries")
    .select("id, status, attempt_count, last_attempt_at")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (!existing) {
    return { claimed: false, reason: "insert_failed_and_not_found" };
  }

  if (existing.status === "sent") {
    return { claimed: false, reason: "already_sent" };
  }

  if (existing.attempt_count >= MAX_ATTEMPTS) {
    return { claimed: false, reason: "max_attempts_reached" };
  }

  // Check processing lease
  if (existing.status === "processing") {
    const lastAttemptDate = new Date(existing.last_attempt_at);
    const leaseAgeMinutes = (nowDate.getTime() - lastAttemptDate.getTime()) / (1000 * 60);

    if (leaseAgeMinutes < PROCESSING_LEASE_MINUTES) {
      return { claimed: false, reason: "in_progress_lease" };
    }
  }

  // Step 3: CAS UPDATE for retry / stale lease
  const newAttemptCount = existing.attempt_count + 1;
  const { data: updatedRows } = await supabase
    .from("notification_deliveries")
    .update({
      status: "processing",
      attempt_count: newAttemptCount,
      last_attempt_at: nowIso,
      error: null,
    })
    .eq("id", existing.id)
    .eq("status", existing.status)
    .eq("attempt_count", existing.attempt_count)
    .select("id, attempt_count");

  if (updatedRows && updatedRows.length > 0) {
    return {
      claimed: true,
      deliveryId: existing.id,
      attemptCount: newAttemptCount,
      isNew: false,
    };
  }

  return { claimed: false, reason: "cas_failed" };
}

/**
 * Core engine method to check upcoming matches and send Web Push notifications with atomic deduplication.
 *
 * @param {Object} [options]
 * @param {Date} [options.nowDate] - Optional override for current time
 * @returns {Promise<Object>} Execution summary metrics
 */
export async function processUpcomingMatchReminders(options = {}) {
  const supabase = getSupabaseServerClient();
  const nowDate = options.nowDate || new Date();

  const metrics = {
    matches_checked: 0,
    events_considered: 0,
    deliveries_attempted: 0,
    deliveries_sent: 0,
    deliveries_skipped_duplicate: 0,
    subscriptions_expired: 0,
    errors: [],
  };

  try {
    // Fetch all upcoming matches
    const { data: matches, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "upcoming");

    if (matchError) {
      metrics.errors.push(`Failed to fetch matches: ${matchError.message}`);
      return metrics;
    }

    metrics.matches_checked = matches?.length || 0;

    for (const match of matches || []) {
      const matchDateTime = getMatchDateTimeGuatemala(match.match_date, match.start_time);
      const reminderTypes = getApplicableReminderTypes(matchDateTime, nowDate);

      if (reminderTypes.length === 0) continue;

      // Fetch confirmed & checked-in players only
      const { data: attendances, error: attError } = await supabase
        .from("attendances")
        .select("profile_id, profiles(*)")
        .eq("match_id", match.id)
        .in("status", ["confirmed", "checked_in"]);

      if (attError) {
        metrics.errors.push(`Error fetching attendances for match ${match.id}: ${attError.message}`);
        continue;
      }

      const playerProfiles = (attendances || []).map((a) => a.profiles || { id: a.profile_id }).filter(Boolean);
      if (playerProfiles.length === 0) continue;

      const playerIds = playerProfiles.map((p) => p.id);

      // Fetch active push subscriptions for these players
      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("profile_id", playerIds);

      if (subError) {
        metrics.errors.push(`Error fetching push_subscriptions: ${subError.message}`);
        continue;
      }

      for (const reminderType of reminderTypes) {
        metrics.events_considered++;

        for (const player of playerProfiles) {
          const dedupeKey = buildDedupeKey(reminderType, match.id, player.id, CHANNELS.PUSH);

          // ATOMIC CLAIM: 1 delivery row per (type, match, profile, channel)
          const claimResult = await claimNotificationDelivery(supabase, {
            profileId: player.id,
            groupId: match.group_id || null,
            matchId: match.id,
            notificationType: reminderType,
            channel: CHANNELS.PUSH,
            dedupeKey,
            nowDate,
          });

          if (!claimResult.claimed) {
            metrics.deliveries_skipped_duplicate++;
            continue;
          }

          // Get subscriptions for this player (multi-device support)
          const playerSubs = (subscriptions || []).filter((s) => s.profile_id === player.id);

          if (playerSubs.length === 0) {
            // No subscriptions to send to -> Mark delivery as skipped
            await supabase
              .from("notification_deliveries")
              .update({
                status: "skipped",
                error: "No active push subscriptions for profile",
              })
              .eq("id", claimResult.deliveryId);
            continue;
          }

          const payload = buildNotificationPayload(reminderType, match, player);
          let anySent = false;
          const subErrors = [];

          for (const sub of playerSubs) {
            metrics.deliveries_attempted++;

            const deliveryResult = await sendPushNotification(sub, payload);

            if (deliveryResult.success) {
              anySent = true;
              metrics.deliveries_sent++;
            } else {
              subErrors.push(deliveryResult.error || `HTTP ${deliveryResult.statusCode}`);
              metrics.errors.push(`Push failed for profile ${player.id}: ${deliveryResult.error}`);

              // Handle expired subscriptions (404/410) by auto-cleaning
              if (deliveryResult.isExpired) {
                metrics.subscriptions_expired++;
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint);
              }
            }
          }

          // FINALIZE DELIVERY RECORD: 1 row per event/profile
          if (anySent) {
            await supabase
              .from("notification_deliveries")
              .update({
                status: "sent",
                sent_at: nowDate.toISOString(),
                error: null,
              })
              .eq("id", claimResult.deliveryId);
          } else {
            await supabase
              .from("notification_deliveries")
              .update({
                status: "failed",
                sent_at: null,
                error: subErrors.join(" | ").substring(0, 500),
              })
              .eq("id", claimResult.deliveryId);
          }
        }
      }
    }
  } catch (err) {
    metrics.errors.push(`Critical error in notification engine: ${err.message}`);
  }

  return metrics;
}
