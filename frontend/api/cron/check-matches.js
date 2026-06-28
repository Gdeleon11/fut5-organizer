import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find matches starting in the next hour
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: upcomingMatches, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "upcoming")
      .gte("match_date", now.toISOString().split("T")[0])
      .lte("match_date", oneHourLater.toISOString().split("T")[0]);

    if (matchError) {
      throw new Error("Failed to fetch upcoming matches");
    }

    const results = [];

    for (const match of upcomingMatches || []) {
      // Check if match is actually within the next hour
      const matchDateTime = new Date(`${match.match_date}T${match.start_time || "19:00"}:00`);
      const diffMinutes = (matchDateTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes > 0 && diffMinutes <= 60) {
        // Get confirmed players
        const { data: attendances } = await supabase
          .from("attendances")
          .select("profile_id")
          .eq("match_id", match.id)
          .in("status", ["confirmed", "checked_in"]);

        const playerIds = (attendances || []).map((a) => a.profile_id);

        if (playerIds.length === 0) continue;

        // Send push notifications
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("*")
          .in("profile_id", playerIds);

        for (const sub of subscriptions || []) {
          try {
            // Note: In production, you'd use a proper Web Push library
            // This is a simplified version
            const pushPayload = {
              title: match.title || "Chamuscón",
              body: `¡Empezá en ${Math.round(diffMinutes)} minutos! ${match.venue || ""}`,
              url: `/match/${match.id}`,
            };

            results.push({
              match_id: match.id,
              player_id: sub.profile_id,
              type: "push",
              queued: true,
            });
          } catch (pushError) {
            results.push({
              match_id: match.id,
              player_id: sub.profile_id,
              type: "push",
              queued: false,
              error: pushError.message,
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      matches_checked: upcomingMatches?.length || 0,
      results,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
