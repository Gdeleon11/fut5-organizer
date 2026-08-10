import {
  getMatchDateTimeGuatemala,
  getApplicableReminderTypes,
} from "../notificationEngine.js";
import {
  NOTIFICATION_TYPES,
  buildDedupeKey,
  buildNotificationPayload,
} from "../notificationTypes.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runNotificationEngineTests() {
  console.log("Running Notification Engine pure unit tests...");

  // 1. Test buildDedupeKey
  const key = buildDedupeKey(
    NOTIFICATION_TYPES.MATCH_REMINDER_24H,
    "match-123",
    "profile-456",
    "push"
  );
  assert(
    key === "match-reminder-24h:match-123:profile-456:push",
    `buildDedupeKey mismatch: ${key}`
  );

  // 2. Test getMatchDateTimeGuatemala
  const matchDate = "2026-08-10";
  const startTime = "19:00";
  const matchDt = getMatchDateTimeGuatemala(matchDate, startTime);
  assert(!isNaN(matchDt.getTime()), "getMatchDateTimeGuatemala returned invalid date");
  assert(
    matchDt.toISOString().includes("2026-08-11T01:00:00.000Z"),
    `Guatemala UTC-6 conversion mismatch: ${matchDt.toISOString()}`
  );

  // 3. Test getApplicableReminderTypes for 24h window (1440 min = 24h)
  const now = new Date("2026-08-10T19:00:00-06:00");
  const match24h = new Date("2026-08-11T19:00:00-06:00");
  const types24h = getApplicableReminderTypes(match24h, now);
  assert(
    types24h.includes(NOTIFICATION_TYPES.MATCH_REMINDER_24H),
    "24h reminder type not matched"
  );

  // 4. Test getApplicableReminderTypes for 1h window (60 min = 1h)
  const match1h = new Date("2026-08-10T20:00:00-06:00");
  const types1h = getApplicableReminderTypes(match1h, now);
  assert(
    types1h.includes(NOTIFICATION_TYPES.MATCH_REMINDER_1H),
    "1h reminder type not matched"
  );

  // 5. Test buildNotificationPayload
  const payload = buildNotificationPayload(
    NOTIFICATION_TYPES.MATCH_REMINDER_24H,
    { id: "m-1", title: "Chamuscón Viernes", venue: "Plaza San Ángel", start_time: "19:00" },
    { full_name: "Guille de León" }
  );
  assert(
    payload.title.includes("Chamuscón Viernes"),
    "Payload title mismatch"
  );
  assert(
    payload.url === "/partidos/m-1",
    "Payload URL mismatch (must point to /partidos/m-1)"
  );

  console.log("✅ All Notification Engine unit tests passed!");
}

// Run if executed directly via Node
if (import.meta.url === `file://${process.argv[1]}`) {
  runNotificationEngineTests();
}
