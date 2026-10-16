"use client";

// Which account dialog view is open, plus the one-time nudge to sign up after a signed-out
// visitor applies to a job. Dismissing the nudge keeps it away for PROMPT_SNOOZE_DAYS.

import { useSyncExternalStore } from "react";

export type AccountView = "prompt" | "signup" | "signin" | "account";

const PROMPT_KEY = "only-hiring:signup-prompt-dismissed";
const PROMPT_SNOOZE_DAYS = 14;

const listeners = new Set<() => void>();
let view: AccountView | null = null;
/** A message shown with the view, such as why a Google sign-in failed. */
let notice: string | null = null;
let signedOut = false;
let promptedThisVisit = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useAccountView(): AccountView | null {
  return useSyncExternalStore(
    subscribe,
    () => view,
    () => null,
  );
}

export function useAccountNotice(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => notice,
    () => null,
  );
}

export function openAccountDialog(next: AccountView, message: string | null = null) {
  view = next;
  notice = message;
  notify();
}

export function closeAccountDialog() {
  if (view === "prompt") snoozePrompt();
  view = null;
  notice = null;
  notify();
}

/** Set once the session has loaded, so the nudge never shows to someone already signed in. */
export function setSignedOut(value: boolean) {
  signedOut = value;
}

function snoozePrompt() {
  try {
    window.localStorage.setItem(PROMPT_KEY, String(Date.now()));
  } catch {}
}

function promptSnoozed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(PROMPT_KEY));
    return at > 0 && Date.now() - at < PROMPT_SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Called when a signed-out visitor applies (marks a job, or opens a post on Reddit). */
export function promptSignUp() {
  if (!signedOut || promptedThisVisit || view !== null || promptSnoozed()) return;
  promptedThisVisit = true;
  openAccountDialog("prompt");
}
