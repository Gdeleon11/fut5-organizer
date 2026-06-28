import { useEffect, useState } from "react";
import { api } from "../api.js";

const VAPID_PUBLIC_KEY = "BEl62iUYdUq9ABaK4eKvN3pLq3Z3e7W3q3Z3e7W3q3Z3e7W3q3Z3e7W3q3Z3e7W3q3Z3e7W3q3Z3e7W3q3Z";

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
        setMessage("Permiso denegado. Activá las notificaciones en tu navegador.");
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

  if (!isSupported) return null;

  return (
    <div className="push-notifications">
      <button
        type="button"
        className={`secondary-button ${isSubscribed ? "subscribed" : ""}`}
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={loading}
      >
        {loading ? "..." : isSubscribed ? "🔔 Notificaciones activas" : "🔔 Activar notificaciones"}
      </button>
      {message && <small className="push-message">{message}</small>}
    </div>
  );
}
