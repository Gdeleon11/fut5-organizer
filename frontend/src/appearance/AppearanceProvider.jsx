import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient.js";
import {
  METADATA_KEY,
  STORAGE_KEY,
  applyAppearance,
  normalizeAppearance,
  pickNewest,
  readLocalAppearance,
  sameAppearance,
  writeLocalAppearance,
} from "./appearance.js";

const AppearanceContext = createContext(null);

const SYNC_DEBOUNCE_MS = 450;

/**
 * Holds the user's design + palette.
 * - Every change is applied and written to localStorage synchronously (no reload, no sign-out).
 * - When a real Supabase session exists, the value is mirrored to the user's own
 *   auth metadata (`auth.updateUser({ data })`) so it follows them across devices.
 *   Demo mode has no session, so nothing leaves the browser there.
 */
export function AppearanceProvider({ children, client = supabase }) {
  const [appearance, setAppearanceState] = useState(() => readLocalAppearance());
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("local"); // local | saving | synced | error
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;

  const pushRemote = useCallback(
    (value) => {
      if (!client || !user) return;
      pendingRef.current = value;
      clearTimeout(timerRef.current);
      setSyncStatus("saving");
      timerRef.current = setTimeout(async () => {
        const toSave = pendingRef.current;
        try {
          const { error } = await client.auth.updateUser({ data: { [METADATA_KEY]: toSave } });
          if (error) throw error;
          if (pendingRef.current === toSave) setSyncStatus("synced");
        } catch {
          setSyncStatus("error");
        }
      }, SYNC_DEBOUNCE_MS);
    },
    [client, user],
  );

  // Track the signed-in user (only to read/write their own metadata).
  useEffect(() => {
    if (!client) return undefined;
    let alive = true;
    client.auth
      .getSession()
      .then(({ data }) => alive && setUser(data?.session?.user || null))
      .catch(() => {});
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      alive = false;
      data?.subscription?.unsubscribe?.();
    };
  }, [client]);

  // Reconcile local vs remote whenever the user (or their metadata) changes.
  useEffect(() => {
    if (!user) {
      setSyncStatus("local");
      return;
    }
    const remoteRaw = user.user_metadata?.[METADATA_KEY];
    const local = appearanceRef.current;
    const remote = remoteRaw ? normalizeAppearance(remoteRaw) : null;
    const winner = pickNewest(local, remote);
    if (remote && winner.updatedAt > local.updatedAt) {
      appearanceRef.current = winner;
      if (!sameAppearance(winner, local)) setAppearanceState(winner);
      writeLocalAppearance(winner);
      setSyncStatus("synced");
    } else if (local.updatedAt > (remote?.updatedAt || 0)) {
      pushRemote(local);
    } else {
      setSyncStatus("synced");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Keep other tabs of the same browser in sync live.
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = normalizeAppearance(JSON.parse(event.newValue));
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
      const next = normalizeAppearance({ ...appearanceRef.current, ...patch, updatedAt: Date.now() });
      if (sameAppearance(next, appearanceRef.current)) return;
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
  appearance: { design: "editorial", palette: "neon", updatedAt: 0 },
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
