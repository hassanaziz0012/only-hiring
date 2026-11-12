"use client";

// The signed-in session, read without asking the server on every page view. Anonymous visitors are the
// vast majority, and every one of them used to cost a /api/auth/get-session function call on load.
// The session cookie is HttpOnly, so the page can't see it. Instead this browser remembers (in
// localStorage) that it was signed in last time, and the session is only fetched when that hint is set
// or when the visitor has just signed in or up (see enableSession).

import { useSyncExternalStore } from "react";
import { authClient } from "./auth-client";

export const SESSION_HINT_KEY = "only-hiring:signed-in";

type SessionState = { data: ReturnType<typeof authClient.useSession>["data"]; isPending: boolean };

const IDLE: SessionState = { data: null, isPending: false };
// What server render and hydration see, so the first client render matches the HTML.
const SERVER: SessionState = { data: null, isPending: true };

const listeners = new Set<() => void>();
let enabled: boolean | null = null;
let latest: SessionState = { data: null, isPending: true };

function notify() {
  listeners.forEach((listener) => listener());
}

function readHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether the session is being fetched. Starts from the signed-in hint. */
export function sessionEnabled(): boolean {
  if (enabled === null) enabled = readHint();
  return enabled;
}

/** Start fetching the session: after a sign-in or sign-up, or before leaving for Google. */
export function enableSession() {
  try {
    window.localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {}
  if (sessionEnabled()) return;
  enabled = true;
  latest = { data: null, isPending: true };
  notify();
}

/** Called by the one component that runs authClient.useSession, while the session is enabled. */
export function publishSession(next: SessionState) {
  latest = next;
  notify();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Signed in from another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_HINT_KEY && event.newValue === "1" && !sessionEnabled()) enableSession();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): SessionState {
  return sessionEnabled() ? latest : IDLE;
}

/** Whether the session is being fetched, for mounting SessionFetcher. */
export function useSessionEnabled(): boolean {
  return useSyncExternalStore(subscribe, sessionEnabled, () => false);
}

/** Like authClient.useSession(), but never calls the server for a browser that isn't signed in. */
export function useAccountSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}
