import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api as defaultApi } from "../../api.js";
import { notificationTarget, relativeTime } from "../../radar/radarModel.js";

const POLL_MS = 60000;

/** In-app notifications (Radar MVP). Polls every 60 s and on focus; no realtime, no push. */
export default function NotificationBell({ radarApi = defaultApi, onNavigate, className = "", compact = false }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState(null);
  const ref = useRef(null);

  const refreshCount = useCallback(async () => {
    try { setUnread(await radarApi.countUnreadNotifications()); } catch { /* offline or not configured */ }
  }, [radarApi]);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try { setItems(await radarApi.listNotifications(30)); } catch { setItems([]); }
    }
  }

  async function markAll() {
    try { await radarApi.markNotificationsRead(null); setUnread(0); setItems((c) => (c || []).map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))); } catch { /* ignore */ }
  }

  async function go(n) {
    setOpen(false);
    if (!n.read_at) {
      try { await radarApi.markNotificationsRead([n.id]); setUnread((u) => Math.max(0, u - 1)); } catch { /* ignore */ }
    }
    onNavigate?.(notificationTarget(n));
  }

  return (
    <div className={`rd-bell ${className}`} ref={ref}>
      <button type="button" className={compact ? "md-tool" : "md-icon-btn rd-bell-btn"} aria-haspopup="true" aria-expanded={open}
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : "Notificaciones"} data-tip="Avisos" onClick={toggle}>
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="rd-bell-dot" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="rd-bell-pop" role="dialog" aria-label="Avisos">
          <div className="rd-bell-head">
            <b>Avisos</b>
            {unread > 0 && <button type="button" className="md-btn md-btn-ghost" onClick={markAll}>Marcar como leídas</button>}
          </div>
          {items === null && <p className="fx-empty" role="status">Cargando…</p>}
          {items && items.length === 0 && <p className="fx-empty">No tenés avisos.</p>}
          {items && items.length > 0 && (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`rd-note-item${n.read_at ? "" : " is-unread"}`} onClick={() => go(n)}>
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                    <small>{relativeTime(n.created_at)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
