"use client";

// The visitor's "applied" marks, a set of job IDs.
//
// Signed out, they live in localStorage. Every storage access is guarded, and if storage is
// unavailable (private mode, blocked site data) the marks still work for the current visit,
// held in memory. Signed in, they live in the visitor's account (/api/applied): on sign-in the
// browser's marks are merged into the account and cleared from localStorage.

import { useSyncExternalStore } from "react";
import { promptSignUp } from "./account-dialog";

const KEY = "only-hiring:applied";
const EMPTY: ReadonlySet<string> = new Set();

const listeners = new Set<() => void>();
let memoryRaw: string | null = null;
let useMemory = false;
let cachedRaw: string | null | undefined;
let cachedSet: ReadonlySet<string> = EMPTY;

/** Set while signed in and the account's marks have loaded. */
let account: { userId: string; ids: ReadonlySet<string> } | null = null;
let connecting: string | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function readRaw(): string | null {
  if (useMemory) return memoryRaw;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    useMemory = true;
    return memoryRaw;
  }
}

function writeRaw(raw: string | null) {
  if (!useMemory) {
    try {
      if (raw == null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, raw);
    } catch {
      useMemory = true;
    }
  }
  memoryRaw = raw;
}

function parse(raw: string | null): ReadonlySet<string> {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? new Set(value.filter((v): v is string => typeof v === "string")) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function localSnapshot(): ReadonlySet<string> {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSet = parse(raw);
  }
  return cachedSet;
}

function getSnapshot(): ReadonlySet<string> {
  return account ? account.ids : localSnapshot();
}

function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

async function postApplied(body: { add?: string[]; remove?: string[] }): Promise<string[]> {
  const response = await fetch("/api/applied", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Saving applied marks failed (${response.status})`);
  const data: { ids?: unknown } = await response.json();
  return Array.isArray(data.ids) ? data.ids.filter((v): v is string => typeof v === "string") : [];
}

/** The set of job IDs marked as applied. Empty during server render and hydration. */
export function useAppliedIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setApplied(id: string, applied: boolean) {
  const next = new Set(getSnapshot());
  if (applied) next.add(id);
  else next.delete(id);

  if (account) {
    const userId = account.userId;
    account = { userId, ids: next };
    notify();
    postApplied(applied ? { add: [id] } : { remove: [id] }).catch((error) => {
      console.error(error);
      if (account?.userId !== userId) return;
      // Undo just this change, keeping any made since.
      const reverted = new Set(account.ids);
      if (applied) reverted.delete(id);
      else reverted.add(id);
      account = { ...account, ids: reverted };
      notify();
    });
    return;
  }

  writeRaw(JSON.stringify([...next]));
  notify();
  if (applied) promptSignUp();
}

/** Switch to the account's marks, first merging in the ones saved in this browser. */
export async function connectAccount(userId: string) {
  if (account?.userId === userId || connecting === userId) return;
  connecting = userId;
  const local = localSnapshot();
  try {
    const ids = await postApplied({ add: [...local] });
    if (connecting !== userId) return;
    // Marks made while the request was in flight still belong to this browser; send them too.
    const late = [...localSnapshot()].filter((id) => !local.has(id));
    account = { userId, ids: new Set([...ids, ...late]) };
    writeRaw(null);
    if (late.length) postApplied({ add: late }).catch(console.error);
    notify();
  } catch (error) {
    // Keep using this browser's marks; the next session change tries again.
    console.error(error);
  } finally {
    if (connecting === userId) connecting = null;
  }
}

/** Back to this browser's marks, after signing out. */
export function disconnectAccount() {
  connecting = null;
  if (!account) return;
  account = null;
  notify();
}
