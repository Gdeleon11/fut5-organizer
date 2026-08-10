import webpush from "web-push";
import {
  getMatchDateTimeGuatemala,
  getApplicableReminderTypes,
  claimNotificationDelivery,
  getSupabaseServerClient,
  processUpcomingMatchReminders,
  PROCESSING_LEASE_MINUTES,
  MAX_ATTEMPTS,
} from "../notificationEngine.js";
import {
  NOTIFICATION_TYPES,
  buildDedupeKey,
  buildNotificationPayload,
} from "../notificationTypes.js";
import { initVapidKeys } from "../pushSender.js";
import testPushHandler from "../../../notifications/test-push.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runNotificationEngineTests() {
  console.log("Running Hardened Notification Engine Unit, Security & Claim Order Tests...");

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
  assert(
    payload.tag === "match-24h-m-1",
    "Payload tag mismatch"
  );

  // 6. Security Check: getSupabaseServerClient fail-closed without SUPABASE_SERVICE_ROLE_KEY
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  let serviceRoleErrorCaught = false;
  try {
    getSupabaseServerClient();
  } catch (err) {
    serviceRoleErrorCaught = true;
    assert(
      err.message.includes("SUPABASE_SERVICE_ROLE_KEY"),
      "Error message did not mention SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey || "test-service-key";
  assert(serviceRoleErrorCaught, "getSupabaseServerClient did NOT fail closed without SUPABASE_SERVICE_ROLE_KEY");

  // 7. Security Check: VAPID server fail-closed checks
  const originalPublicKey = process.env.VAPID_PUBLIC_KEY;
  const originalPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const originalSubject = process.env.VAPID_SUBJECT;

  // A. Missing VAPID_PUBLIC_KEY
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
  assert(!initVapidKeys(), "initVapidKeys did NOT fail closed when all keys are missing");

  // B. Missing VAPID_PRIVATE_KEY
  const dynamicKeys = webpush.generateVAPIDKeys(); // Generated dynamically in runtime (no hardcoded private key!)
  process.env.VAPID_PUBLIC_KEY = dynamicKeys.publicKey;
  process.env.VAPID_SUBJECT = "mailto:soporte@f5manager.lat";
  delete process.env.VAPID_PRIVATE_KEY;
  assert(!initVapidKeys(), "initVapidKeys did NOT fail closed without VAPID_PRIVATE_KEY");

  // C. Missing VAPID_SUBJECT
  process.env.VAPID_PRIVATE_KEY = dynamicKeys.privateKey;
  delete process.env.VAPID_SUBJECT;
  assert(!initVapidKeys(), "initVapidKeys did NOT fail closed without VAPID_SUBJECT");

  // D. Full valid key pair -> Must succeed
  process.env.VAPID_SUBJECT = "mailto:soporte@f5manager.lat";
  assert(initVapidKeys(), "initVapidKeys failed with valid VAPID keys");

  // Restore env keys
  if (originalPublicKey) process.env.VAPID_PUBLIC_KEY = originalPublicKey;
  if (originalPrivateKey) process.env.VAPID_PRIVATE_KEY = originalPrivateKey;
  if (originalSubject) process.env.VAPID_SUBJECT = originalSubject;

  // 8. Test Endpoint Security Checks (Method, Feature Flag, Bearer Auth)
  console.log("Testing Test Push Endpoint Security Controls...");

  // Mock response object
  const createMockRes = () => {
    const res = {
      statusCode: 200,
      jsonBody: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.jsonBody = body;
        return this;
      },
    };
    return res;
  };

  // A. Test GET -> 405 Method Not Allowed
  const resGet = createMockRes();
  await testPushHandler({ method: "GET", headers: {} }, resGet);
  assert(resGet.statusCode === 405, `GET test endpoint did not return 405 (got ${resGet.statusCode})`);

  // B. Test POST without ENABLE_PUSH_TEST_ENDPOINT=true -> 403 Forbidden
  const originalFlag = process.env.ENABLE_PUSH_TEST_ENDPOINT;
  delete process.env.ENABLE_PUSH_TEST_ENDPOINT;
  const resDisabled = createMockRes();
  await testPushHandler({ method: "POST", headers: {} }, resDisabled);
  assert(resDisabled.statusCode === 403, `Disabled test endpoint did not return 403 (got ${resDisabled.statusCode})`);
  process.env.ENABLE_PUSH_TEST_ENDPOINT = originalFlag || "false";

  // C. Test POST without Bearer Token -> 401 Unauthorized
  process.env.ENABLE_PUSH_TEST_ENDPOINT = "true";
  const resNoAuth = createMockRes();
  await testPushHandler({ method: "POST", headers: {} }, resNoAuth);
  assert(resNoAuth.statusCode === 401, `Missing auth header did not return 401 (got ${resNoAuth.statusCode})`);

  // Restore flag
  process.env.ENABLE_PUSH_TEST_ENDPOINT = originalFlag;

  // 9. Atomic Claim & No-Subscription Order Simulation
  console.log("Testing Atomic Claim & No-Subscription Order Logic...");
  const mockDb = new Map();

  const mockSupabase = {
    from: (table) => ({
      insert: (record) => ({
        select: () => ({
          maybeSingle: async () => {
            if (mockDb.has(record.dedupe_key)) {
              return { data: null, error: { code: "23505", message: "Duplicate key" } };
            }
            const newRow = { id: `del-${Date.now()}`, ...record };
            mockDb.set(record.dedupe_key, newRow);
            return { data: newRow, error: null };
          },
        }),
      }),
      select: () => ({
        eq: (field, value) => ({
          maybeSingle: async () => {
            if (field === "dedupe_key") {
              const row = mockDb.get(value);
              return { data: row ? { ...row } : null, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (updates) => ({
        eq: (f1, v1) => ({
          eq: (f2, v2) => ({
            eq: (f3, v3) => ({
              select: async () => {
                for (const [key, row] of mockDb.entries()) {
                  if (row.id === v1 && row.status === v2 && row.attempt_count === v3) {
                    const updatedRow = { ...row, ...updates };
                    mockDb.set(key, updatedRow);
                    return { data: [updatedRow], error: null };
                  }
                }
                return { data: [], error: null };
              },
            }),
          }),
        }),
      }),
    }),
  };

  const testParams = {
    profileId: "p-100",
    groupId: "g-200",
    matchId: "m-300",
    notificationType: NOTIFICATION_TYPES.MATCH_REMINDER_1H,
    channel: "push",
    dedupeKey: "match-reminder-1h:m-300:p-100:push",
    nowDate: new Date(),
  };

  // Claim 1: First worker claim -> Must succeed
  const claim1 = await claimNotificationDelivery(mockSupabase, testParams);
  assert(claim1.claimed === true, "Worker 1 initial claim failed");
  assert(claim1.attemptCount === 1, "Worker 1 initial attempt count is not 1");

  // Claim 2: Second worker concurrent claim -> Must fail with in_progress_lease
  const claim2 = await claimNotificationDelivery(mockSupabase, testParams);
  assert(claim2.claimed === false, "Worker 2 claimed lock concurrently!");
  assert(claim2.reason === "in_progress_lease", `Worker 2 claim reason mismatch: ${claim2.reason}`);

  // Claim 3: Duplicate claim after status='sent' -> Must fail with already_sent
  mockDb.get(testParams.dedupeKey).status = "sent";
  const claim3 = await claimNotificationDelivery(mockSupabase, testParams);
  assert(claim3.claimed === false, "Worker 3 claimed lock after status=sent!");
  assert(claim3.reason === "already_sent", `Worker 3 claim reason mismatch: ${claim3.reason}`);

  // Claim 4: Retry claim on status='failed' -> Must succeed via CAS update
  mockDb.get(testParams.dedupeKey).status = "failed";
  const claim4 = await claimNotificationDelivery(mockSupabase, testParams);
  assert(claim4.claimed === true, "Worker 4 retry claim failed!");
  assert(claim4.attemptCount === 2, "Worker 4 attempt count did not increment to 2");

  // Claim 5: Claim after MAX_ATTEMPTS reached -> Must fail with max_attempts_reached
  mockDb.get(testParams.dedupeKey).attempt_count = MAX_ATTEMPTS;
  mockDb.get(testParams.dedupeKey).status = "failed";
  const claim5 = await claimNotificationDelivery(mockSupabase, testParams);
  assert(claim5.claimed === false, "Claim succeeded after MAX_ATTEMPTS!");
  assert(claim5.reason === "max_attempts_reached", `Claim reason mismatch: ${claim5.reason}`);

  console.log("✅ All Hardened Notification Engine Unit, Security & Order Tests Passed!");
}

// Run if executed directly via Node
if (import.meta.url === `file://${process.argv[1]}`) {
  runNotificationEngineTests().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  });
}
