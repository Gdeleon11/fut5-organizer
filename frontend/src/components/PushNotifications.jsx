import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bell, BellRing, Loader2, Send, AlertTriangle } from "lucide-react";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const ENABLE_PUSH_TESTS = import.meta.env.VITE_ENABLE_PUSH_TESTS === "true";

function urlBase64ToUint8Array(base64String) {
  if (!base64String) return new Uint8Array(0);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Compares an existing subscription's applicationServerKey ArrayBuffer against the current VAPID base64 key.
 */
function isSameApplicationServerKey(existingKeyBuffer, currentVapidBase64) {
  if (!existingKeyBuffer || !currentVapidBase64) return false;
  const currentBytes = urlBase64ToUint8Array(currentVapidBase64);
  const existingBytes = new Uint8Array(existingKeyBuffer);

  if (existingBytes.length !== currentBytes.length) return false;
  for (let i = 0; i < existingBytes.length; i++) {
    if (existingBytes[i] !== currentBytes[i]) return false;
  }
  return true;
}

export default function PushNotifications({ profile }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [needsReactivation, setNeedsReactivation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      if (VAPID_PUBLIC_KEY) {
        checkSubscription();
      } else {
        setMessage("Notificaciones no configuradas");
      }
    }
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        setNeedsReactivation(false);
        return;
      }

      // VAPID key compatibility check
      const appServerKey = subscription.options?.applicationServerKey;
      const keyMatches = isSameApplicationServerKey(appServerKey, VAPID_PUBLIC_KEY);

      if (keyMatches) {
        setIsSubscribed(true);
        setNeedsReactivation(false);
      } else {
        setIsSubscribed(false);
        setNeedsReactivation(true);
        setMessage("Se requiere reactivar notificaciones debido a un cambio de servidor");
      }
    } catch {
      setIsSupported(false);
    }
  }

  async function subscribe() {
    if (!VAPID_PUBLIC_KEY) {
      setMessage("VAPID key no configurada en el cliente");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      // If an existing subscription is active (e.g. from an older server key), unsubscribe cleanly
      if (existingSubscription) {
        try {
          await existingSubscription.unsubscribe();
          if (profile?.id && existingSubscription.endpoint) {
            await api.removePushSubscription(profile.id, existingSubscription.endpoint);
          }
        } catch (unsubErr) {
          console.warn("[PushNotifications] Could not clean old subscription:", unsubErr);
        }
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = newSubscription.toJSON();
      await api.savePushSubscription({
        profile_id: profile.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh || "",
        auth: subJson.keys?.auth || "",
        user_agent: navigator.userAgent,
      });

      setIsSubscribed(true);
      setNeedsReactivation(false);
      setMessage("Notificaciones activadas");
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setMessage("Permiso denegado en tu navegador.");
      } else {
        setMessage("Error al activar notificaciones");
      }
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        if (profile?.id) {
          await api.removePushSubscription(profile.id, subscription.endpoint);
        }
      }
      setIsSubscribed(false);
      setNeedsReactivation(false);
      setMessage("Notificaciones desactivadas");
    } catch {
      setMessage("Error al desactivar notificaciones");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTestPush() {
    setLoading(true);
    setMessage("");
    try {
      const res = await api.sendTestPushNotification();
      setMessage(res.message || "Notificación de prueba enviada");
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!isSupported) return null;

  return (
    <div className="push-notifications" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      <button
        type="button"
        className={`f5-icon-btn ${isSubscribed ? "is-active" : ""}`}
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={loading || !VAPID_PUBLIC_KEY}
        title={
          !VAPID_PUBLIC_KEY
            ? "Notificaciones Web Push no configuradas"
            : needsReactivation
            ? "Reactivar notificaciones Web Push"
            : isSubscribed
            ? "Notificaciones Web Push activas (clic para desactivar)"
            : "Activar notificaciones Web Push"
        }
        aria-label={isSubscribed ? "Desactivar notificaciones Web Push" : "Activar notificaciones Web Push"}
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "var(--r-sm)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: isSubscribed
            ? "rgba(16, 185, 129, 0.15)"
            : needsReactivation
            ? "rgba(245, 158, 11, 0.15)"
            : "var(--surface-2)",
          border: isSubscribed
            ? "1px solid rgba(16, 185, 129, 0.3)"
            : needsReactivation
            ? "1px solid rgba(245, 158, 11, 0.4)"
            : "1px solid var(--border-subtle)",
          color: isSubscribed
            ? "var(--primary)"
            : needsReactivation
            ? "var(--warning, #f59e0b)"
            : "var(--text-secondary)",
          cursor: VAPID_PUBLIC_KEY ? "pointer" : "not-allowed",
          transition: "all 180ms ease",
        }}
      >
        {loading ? (
          <Loader2 size={18} style={{ animation: "f5-spin-anim 1s linear infinite" }} />
        ) : needsReactivation ? (
          <AlertTriangle size={18} />
        ) : isSubscribed ? (
          <BellRing size={18} />
        ) : (
          <Bell size={18} />
        )}
      </button>

      {ENABLE_PUSH_TESTS && isSubscribed && (
        <button
          type="button"
          onClick={handleSendTestPush}
          disabled={loading}
          title="Probar notificación Web Push"
          style={{
            height: "38px",
            padding: "0 0.6rem",
            fontSize: "0.75rem",
            borderRadius: "var(--r-sm)",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            cursor: "pointer",
          }}
        >
          <Send size={14} /> Probar
        </button>
      )}

      {message && (
        <span
          className="push-message"
          style={{
            fontSize: "0.75rem",
            color: needsReactivation ? "var(--warning, #f59e0b)" : "var(--text-secondary)",
            background: "var(--surface-2)",
            padding: "0.2rem 0.5rem",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
