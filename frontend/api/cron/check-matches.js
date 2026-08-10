import { processUpcomingMatchReminders } from "../_lib/notifications/notificationEngine.js";

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
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
