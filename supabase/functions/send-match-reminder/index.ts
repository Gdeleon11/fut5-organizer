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
    const { match_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get match details
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match_id)
      .single();

    if (matchError || !match) {
      throw new Error("Match not found");
    }

    // Get confirmed attendances with player profiles
    const { data: attendances, error: attError } = await supabase
      .from("attendances")
      .select("profile_id, profiles(id, full_name, email)")
      .eq("match_id", match_id)
      .in("status", ["confirmed", "checked_in"]);

    if (attError || !attendances) {
      throw new Error("Failed to fetch attendances");
    }

    // Get teams with members
    const { data: teams } = await supabase
      .from("teams")
      .select("*, team_members(*, profiles(id, full_name, email))")
      .eq("match_id", match_id)
      .order("team_order");

    // Send email to each confirmed player
    const results = [];
    for (const attendance of attendances) {
      const player = attendance.profiles;
      if (!player?.email) continue;

      const team = teams?.find((t) =>
        t.team_members?.some((m) => m.profile_id === player.id)
      );

      const teamName = team?.name || "Sin equipo asignado";
      const playerName = player.full_name || "Jugador";
      const matchDate = new Date(match.match_date).toLocaleDateString("es-GT", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      results.push({
        email: player.email,
        name: playerName,
        team: teamName,
        matchDate,
      });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
