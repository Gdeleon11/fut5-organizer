import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BChz-bc_HZwtRJCNMu7aM6KeFhjYP8FX6RWaZq_EJX2hdxmB_9y5t8WsSu2UVi_e8a5D7vZ9XhXWHSPVtxwTqos";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotifications({ profile }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSupported(false);
    }
  }

  async function subscribe() {
    setLoading(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const sub = subscription.toJSON();
      await api.savePushSubscription({
        profile_id: profile.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: navigator.userAgent,
      });

      setIsSubscribed(true);
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
        await api.removePushSubscription(profile.id, subscription.endpoint);
      }
      setIsSubscribed(false);
      setMessage("Notificaciones desactivadas");
    } catch {
      setMessage("Error al desactivar notificaciones");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTestPush() {
    if (!profile) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await api.sendTestPushNotification(profile.id);
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
        disabled={loading}
        title={isSubscribed ? "Notificaciones Web Push activas (clic para desactivar)" : "Activar notificaciones Web Push"}
        aria-label={isSubscribed ? "Desactivar notificaciones Web Push" : "Activar notificaciones Web Push"}
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "var(--r-sm)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: isSubscribed ? "rgba(16, 185, 129, 0.15)" : "var(--surface-2)",
          border: isSubscribed ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border-subtle)",
          color: isSubscribed ? "var(--primary)" : "var(--text-secondary)",
          cursor: "pointer",
          transition: "all 180ms ease"
        }}
      >
        {loading ? (
          <Loader2 size={18} style={{ animation: "f5-spin-anim 1s linear infinite" }} />
        ) : isSubscribed ? (
          <BellRing size={18} />
        ) : (
          <Bell size={18} />
        )}
      </button>

      {message && (
        <span
          className="push-message"
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            background: "var(--surface-2)",
            padding: "0.2rem 0.5rem",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--border-subtle)"
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
