import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient.js";
import {
  METADATA_KEY,
  STORAGE_KEY,
  applyAppearance,
  normalizeAppearance,
  readLocalAppearance,
  reconcileAppearance,
  sameAppearance,
  toRemote,
  writeLocalAppearance,
} from "./appearance.js";

const AppearanceContext = createContext(null);

const SYNC_DEBOUNCE_MS = 450;

/**
 * Holds the user's design + palette.
 * - Every change is applied and written to localStorage synchronously (no reload, no sign-out).
 * - With a real Supabase session the value is mirrored to the user's own auth metadata
 *   (`auth.updateUser({ data: { f5_appearance } })`; Supabase merges `data` into the
 *   existing metadata, other keys are kept). Other devices pick it up when they load or
 *   refresh the session — this is not a live/realtime push.
 * - Demo mode has no session, so nothing leaves the browser there.
 */
export function AppearanceProvider({ children, client = supabase }) {
  const [appearance, setAppearanceState] = useState(() => readLocalAppearance());
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("local"); // local | saving | synced | error
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const userRef = useRef(null);
  userRef.current = user;

  const pushRemote = useCallback(
    (value) => {
      if (!client || !userRef.current) return;
      pendingRef.current = value;
      clearTimeout(timerRef.current);
      setSyncStatus("saving");
      timerRef.current = setTimeout(async () => {
        const toSave = pendingRef.current;
        try {
          const { error } = await client.auth.updateUser({ data: { [METADATA_KEY]: toRemote(toSave) } });
          if (error) throw error;
          if (pendingRef.current === toSave) setSyncStatus("synced");
        } catch {
          // Local value stays applied; the next change (or next load) retries.
          setSyncStatus("error");
        }
      }, SYNC_DEBOUNCE_MS);
    },
    [client],
  );

  // Track the signed-in user. getSession() can hold a cached user whose metadata is
  // stale (another device may have changed it), so we re-read it from Auth once.
  useEffect(() => {
    if (!client) return undefined;
    let alive = true;
    client.auth
      .getSession()
      .then(async ({ data }) => {
        const sessionUser = data?.session?.user || null;
        if (!alive) return;
        if (!sessionUser) {
          setUser(null);
          return;
        }
        try {
          const { data: fresh, error } = await client.auth.getUser();
          if (alive) setUser(!error && fresh?.user ? fresh.user : sessionUser);
        } catch {
          if (alive) setUser(sessionUser); // offline: fall back to the cached copy
        }
      })
      .catch(() => {});
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return; // handled above with a fresh read
      setUser(session?.user || null);
    });
    return () => {
      alive = false;
      data?.subscription?.unsubscribe?.();
    };
  }, [client]);

  // Reconcile local vs remote whenever the user (or their metadata) changes.
  const userId = user?.id || null;
  const remoteStamp = Number(user?.user_metadata?.[METADATA_KEY]?.updatedAt) || 0;
  useEffect(() => {
    if (!user) {
      setSyncStatus("local");
      return;
    }
    const local = appearanceRef.current;
    const { value, push } = reconcileAppearance(local, user.user_metadata?.[METADATA_KEY], user.id);
    const next = normalizeAppearance(value);
    appearanceRef.current = next;
    if (!sameAppearance(next, local) || next.updatedAt !== local.updatedAt || next.userId !== local.userId) {
      setAppearanceState(next);
      writeLocalAppearance(next);
    }
    if (push) pushRemote(next);
    else setSyncStatus("synced");
    // Re-run only when the account or its stored preference timestamp changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, remoteStamp]);

  // Keep other tabs of the same browser in sync live.
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = normalizeAppearance(JSON.parse(event.newValue));
        appearanceRef.current = next;
        setAppearanceState((current) => (sameAppearance(current, next) ? current : next));
      } catch {
        /* ignore malformed values */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const setAppearance = useCallback(
    (patch) => {
      const current = appearanceRef.current;
      const next = normalizeAppearance({
        ...current,
        ...patch,
        updatedAt: Math.max(Date.now(), current.updatedAt + 1),
        userId: userRef.current?.id || null,
      });
      if (sameAppearance(next, current)) return;
      appearanceRef.current = next;
      setAppearanceState(next);
      writeLocalAppearance(next);
      pushRemote(next);
    },
    [pushRemote],
  );

  const value = useMemo(
    () => ({
      design: appearance.design,
      palette: appearance.palette,
      appearance,
      setAppearance,
      setDesign: (design) => setAppearance({ design }),
      setPalette: (palette) => setAppearance({ palette }),
      syncStatus,
      canSyncRemotely: Boolean(client && user),
    }),
    [appearance, setAppearance, syncStatus, client, user],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

const FALLBACK = {
  design: "editorial",
  palette: "neon",
  appearance: { design: "editorial", palette: "neon", updatedAt: 0, userId: null },
  setAppearance: () => {},
  setDesign: () => {},
  setPalette: () => {},
  syncStatus: "local",
  canSyncRemotely: false,
};

export function useAppearance() {
  return useContext(AppearanceContext) || FALLBACK;
}

/**
 * Applies the current appearance to <html> while mounted. Rendered only inside the
 * signed-in app shell, so public pages (landing, blog, legal) keep their own look.
 */
export function AppearanceScope() {
  const { appearance } = useAppearance();
  useEffect(() => applyAppearance(appearance), [appearance]);
  return null;
}
