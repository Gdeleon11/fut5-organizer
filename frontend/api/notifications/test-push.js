import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "../_lib/notifications/pushSender.js";

export default async function handler(req, res) {
  // 1. Accept ONLY POST
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  // 2. Feature Flag Check (Server-Side)
  if (process.env.ENABLE_PUSH_TEST_ENDPOINT !== "true") {
    return res.status(403).json({
      success: false,
      error: "Test push endpoint is disabled in this environment.",
    });
  }

  // 3. Authorization Bearer Token Mandatory Check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Missing or invalid Authorization Bearer token",
    });
  }

  const token = authHeader.substring(7);
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      success: false,
      error: "Server misconfigured: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 4. Validate Token & Derive Profile ID EXCLUSIVELY from Auth User
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or expired access token",
    });
  }

  // Derived EXCLUSIVELY from user.id
  const authenticatedProfileId = user.id;

  try {
    // Fetch profile and active push subscriptions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, nickname")
      .eq("id", authenticatedProfileId)
      .single();

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("profile_id", authenticatedProfileId);

    if (subError) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch push subscriptions: ${subError.message}`,
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active push subscriptions found for your profile. Please activate push notifications in your browser first.",
        subscriptions_found: 0,
      });
    }

    const payload = {
      title: "⚽ Notificación de prueba F5Manager",
      body: `¡Hola ${profile?.nickname || profile?.full_name || "jugador"}! Tu navegador recibe notificaciones Web Push correctamente.`,
      url: "/partidos",
      tag: `test-push-${Date.now()}`,
      data: { test: true },
    };

    const results = [];
    let sentCount = 0;
    let expiredCount = 0;

    for (const sub of subscriptions) {
      const delivery = await sendPushNotification(sub, payload);

      if (delivery.success) {
        sentCount++;
      } else if (delivery.isExpired) {
        expiredCount++;
        // Auto-clean expired subscription
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }

      results.push({
        endpoint_short: sub.endpoint.substring(0, 40) + "...",
        success: delivery.success,
        statusCode: delivery.statusCode,
        isExpired: delivery.isExpired,
        error: delivery.error,
      });
    }

    return res.status(200).json({
      success: sentCount > 0,
      message: sentCount > 0 ? "Notificación de prueba enviada con éxito" : "Error al enviar notificación de prueba",
      sent_count: sentCount,
      expired_count: expiredCount,
      total_subscriptions: subscriptions.length,
      results,
    });
  } catch (err) {
    console.error("[api/notifications/test-push] Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
}
