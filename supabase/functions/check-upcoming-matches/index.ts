import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
      const matchDateTime = new Date(`${match.match_date}T${match.start_time || "19:00"}:00`);
      const diffMinutes = (matchDateTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes > 0 && diffMinutes <= 60) {
        const { data: attendances } = await supabase
          .from("attendances")
          .select("profile_id")
          .eq("match_id", match.id)
          .in("status", ["confirmed", "checked_in"]);

        const playerIds = (attendances || []).map((a) => a.profile_id);
        if (playerIds.length === 0) continue;

        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("*")
          .in("profile_id", playerIds);

        for (const sub of subscriptions || []) {
          try {
            const pushPayload = JSON.stringify({
              title: match.title || "Chamuscón",
              body: `¡Empezá en ${Math.round(diffMinutes)} minutos! ${match.venue || ""}`,
              url: `/`,
            });

            // Store notification for later delivery
            await supabase.from("notifications").insert({
              profile_id: sub.profile_id,
              title: match.title || "Chamuscón",
              body: `¡Empezá en ${Math.round(diffMinutes)} minutos! ${match.venue || ""}`,
              type: "match_reminder",
              match_id: match.id,
            });

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

    return new Response(
      JSON.stringify({ success: true, matches_checked: upcomingMatches?.length || 0, results }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
