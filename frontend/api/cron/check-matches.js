import { processUpcomingMatchReminders } from "../_lib/notifications/notificationEngine.js";

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;

  // FAIL CLOSED: Require CRON_SECRET to be configured server-side
  if (!cronSecret) {
    console.error("[cron/check-matches] CRON_SECRET is missing from server environment.");
    return res.status(500).json({
      success: false,
      error: "Server misconfigured: CRON_SECRET is required to execute cron jobs",
    });
  }

  // Verify Authorization header against CRON_SECRET
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing cron authorization token",
    });
  }

  try {
    const metrics = await processUpcomingMatchReminders();

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...metrics,
    });
  } catch (error) {
    console.error("[cron/check-matches] Error executing notification engine:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
