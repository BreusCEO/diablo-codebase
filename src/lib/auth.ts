"use client";

import { useSyncExternalStore } from "react";

/**
 * Authentication seam. The demo has no accounts: DemoAuth keeps a session
 * flag for this tab only. A real provider implements the same interface and
 * drops in without touching the UI.
 */
export interface Session {
  user: { name: string; initials: string };
  workspace: string;
  demo: boolean;
}

export interface AuthProvider {
  getSession(): Session | null;
  signIn(): Promise<Session>;
  signOut(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

const KEY = "diablo.session";
const DEMO_SESSION: Session = { user: { name: "Demo researcher", initials: "DR" }, workspace: "Demo workspace", demo: true };

const listeners = new Set<() => void>();
let cached: Session | null | undefined;

export const DemoAuth: AuthProvider = {
  getSession() {
    if (cached !== undefined) return cached;
    try {
      cached = sessionStorage.getItem(KEY) === "demo" ? DEMO_SESSION : null;
    } catch {
      cached = null;
    }
    return cached;
  },
  async signIn() {
    try {
      sessionStorage.setItem(KEY, "demo");
    } catch {}
    cached = DEMO_SESSION;
    listeners.forEach((l) => l());
    return DEMO_SESSION;
  },
  async signOut() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    cached = null;
    listeners.forEach((l) => l());
  },
  subscribe(l) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export const auth: AuthProvider = DemoAuth;

/**
 * The demo workspace works without signing in (there is nothing to protect);
 * the account row shows the demo identity either way.
 */
export function useSession(): Session {
  const s = useSyncExternalStore(auth.subscribe, auth.getSession, () => null);
  return s ?? DEMO_SESSION;
}
