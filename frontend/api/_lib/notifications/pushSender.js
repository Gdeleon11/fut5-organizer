import webpush from "web-push";

let vapidInitialized = false;

/**
 * Initializes web-push VAPID configuration safely from server-side environment variables.
 * Fails closed if any VAPID key is missing.
 *
 * @returns {boolean} True if initialized successfully, false otherwise
 */
export function initVapidKeys() {
  if (vapidInitialized) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:soporte@f5manager.lat";

  if (!publicKey || !privateKey) {
    console.error("[pushSender] VAPID configuration error: Both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required server-side.");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidInitialized = true;
    return true;
  } catch (err) {
    console.error("[pushSender] Error setting VAPID details:", err.message);
    return false;
  }
}

/**
 * Sends a real Web Push notification to a single browser subscription.
 *
 * @param {Object} subscription - DB Push Subscription record (endpoint, p256dh, auth)
 * @param {Object} payload - Notification payload object { title, body, url, tag, data }
 * @returns {Promise<Object>} Delivery result { success, statusCode, isExpired, error }
 */
export async function sendPushNotification(subscription, payload) {
  if (!subscription || !subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return {
      success: false,
      statusCode: 400,
      isExpired: false,
      error: "Invalid subscription object (missing endpoint, p256dh, or auth)",
    };
  }

  const initialized = initVapidKeys();
  if (!initialized) {
    return {
      success: false,
      statusCode: 500,
      isExpired: false,
      error: "VAPID configuration error: VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY are required server-side",
    };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const payloadString = JSON.stringify({
    title: payload.title || "F5Manager",
    body: payload.body || "",
    url: payload.url || "/partidos",
    tag: payload.tag || "f5manager-notification",
    data: payload.data || {},
  });

  try {
    const result = await webpush.sendNotification(pushSubscription, payloadString);
    return {
      success: true,
      statusCode: result.statusCode || 201,
      isExpired: false,
      error: null,
    };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const isExpired = statusCode === 404 || statusCode === 410;

    return {
      success: false,
      statusCode,
      isExpired,
      error: err.message || "Push service error",
    };
  }
}
