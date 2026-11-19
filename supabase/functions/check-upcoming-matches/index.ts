import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron-invoked Edge Function: authenticated exclusively via shared CRON_SECRET
// (constant-time comparison). Does NOT rely on verify_jwt and NEVER accepts anon traffic.
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://f5manager.lat",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type",
};

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  const cronSecret = (Deno.env.get("CRON_SECRET") || "").trim();
  if (cronSecret.length < 16) {
    return new Response(JSON.stringify({ error: "Cron secret not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 503,
    });
  }

  const authHeader = (req.headers.get("Authorization") || "").trim();
  const bearerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = (req.headers.get("x-cron-secret") || "").trim();
  const providedSecret = headerSecret || bearerSecret;

  if (!providedSecret || !constantTimeEqual(providedSecret, cronSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: upcomingMatches, error: matchError } = await supabase
      .from("matches")
      .select("id, match_date, start_time")
      .eq("status", "upcoming")
      .gte("match_date", now.toISOString().split("T")[0])
      .lte("match_date", oneHourLater.toISOString().split("T")[0]);

    if (matchError) {
      throw new Error("Failed to fetch upcoming matches");
    }

    const eligibleMatches = (upcomingMatches || []).filter((match) => {
      const matchDateTime = new Date(`${match.match_date}T${match.start_time || "19:00"}:00`);
      const diffMinutes = (matchDateTime.getTime() - now.getTime()) / (1000 * 60);
      return diffMinutes > 0 && diffMinutes <= 60;
    });

    // Returns only aggregate counts — zero player PII or match details
    return new Response(
      JSON.stringify({
        success: true,
        matches_checked: upcomingMatches?.length || 0,
        matches_within_window: eligibleMatches.length,
        push_delivery_enabled: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
