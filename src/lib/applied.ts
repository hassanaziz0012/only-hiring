"use client";

// The visitor's "applied" marks: a set of job IDs in localStorage, nothing on the server.
// Every storage access is guarded, and if storage is unavailable (private mode, blocked
// site data) the marks still work for the current visit, held in memory.

import { useSyncExternalStore } from "react";

const KEY = "only-hiring:applied";
const EMPTY: ReadonlySet<string> = new Set();

const listeners = new Set<() => void>();
let memoryRaw: string | null = null;
let useMemory = false;
let cachedRaw: string | null | undefined;
let cachedSet: ReadonlySet<string> = EMPTY;

function readRaw(): string | null {
  if (useMemory) return memoryRaw;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    useMemory = true;
    return memoryRaw;
  }
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

function getSnapshot(): ReadonlySet<string> {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSet = parse(raw);
  }
  return cachedSet;
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

/** The set of job IDs marked as applied. Empty during server render and hydration. */
export function useAppliedIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setApplied(id: string, applied: boolean) {
  const next = new Set(getSnapshot());
  if (applied) next.add(id);
  else next.delete(id);
  const raw = JSON.stringify([...next]);
  if (!useMemory) {
    try {
      window.localStorage.setItem(KEY, raw);
    } catch {
      useMemory = true;
    }
  }
  memoryRaw = raw;
  listeners.forEach((listener) => listener());
}
