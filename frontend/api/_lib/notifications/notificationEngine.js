import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "./pushSender.js";
import {
  NOTIFICATION_TYPES,
  CHANNELS,
  buildDedupeKey,
  buildNotificationPayload,
} from "./notificationTypes.js";

/**
 * Returns a Supabase client initialized with server-side environment variables.
 */
export function getSupabaseServerClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  const key = serviceRoleKey || anonKey;
  if (!supabaseUrl || !key) {
    throw new Error("Missing Supabase environment configuration (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/ANON_KEY)");
  }

  return createClient(supabaseUrl, key);
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
 * Core engine method to check upcoming matches and send Web Push notifications with deduplication.
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

          // Idempotency check: look up in notification_deliveries table
          const { data: existingDelivery } = await supabase
            .from("notification_deliveries")
            .select("id")
            .eq("dedupe_key", dedupeKey)
            .maybeSingle();

          if (existingDelivery) {
            metrics.deliveries_skipped_duplicate++;
            continue;
          }

          // Get subscriptions for this player
          const playerSubs = (subscriptions || []).filter((s) => s.profile_id === player.id);

          if (playerSubs.length === 0) continue;

          const payload = buildNotificationPayload(reminderType, match, player);

          for (const sub of playerSubs) {
            metrics.deliveries_attempted++;

            const deliveryResult = await sendPushNotification(sub, payload);

            // Record delivery attempt in DB
            const deliveryStatus = deliveryResult.success ? "sent" : "failed";
            const { error: insertError } = await supabase
              .from("notification_deliveries")
              .insert({
                profile_id: player.id,
                group_id: match.group_id || null,
                match_id: match.id,
                notification_type: reminderType,
                channel: CHANNELS.PUSH,
                dedupe_key: dedupeKey,
                status: deliveryStatus,
                attempt_count: 1,
                error: deliveryResult.error || null,
              });

            if (insertError) {
              console.warn(`[notificationEngine] Could not insert delivery record: ${insertError.message}`);
            }

            if (deliveryResult.success) {
              metrics.deliveries_sent++;
            } else {
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
        }
      }
    }
  } catch (err) {
    metrics.errors.push(`Critical error in notification engine: ${err.message}`);
  }

  return metrics;
}
