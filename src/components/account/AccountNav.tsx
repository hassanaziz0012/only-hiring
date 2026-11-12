"use client";

import { useSyncExternalStore } from "react";
import { openAccountDialog } from "@/lib/account-dialog";
import { SESSION_HINT_KEY, useAccountSession } from "@/lib/session";

// Whether this browser was signed in last time the session loaded. The label shows straight away
// from this guess instead of waiting about half a second for the session request, which painted
// the header late and held back Speed Index on every page.
const HINT_KEY = SESSION_HINT_KEY;

function readHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

/** "Sign in", or "Account" once signed in. */
export function AccountNav({
  className = "link tap",
  onOpen,
}: {
  className?: string;
  /** Runs before the dialog opens, such as to close the mobile menu. */
  onOpen?: () => void;
}) {
  const { data: session, isPending } = useAccountSession();
  // False during server render and hydration, so the first client render matches the HTML.
  const hint = useSyncExternalStore(noSubscribe, readHint, () => false);
  const signedIn = isPending ? hint : Boolean(session);

  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      onClick={() => {
        onOpen?.();
        openAccountDialog(signedIn ? "account" : "signin");
      }}
    >
      {signedIn ? "Account" : "Sign in"}
    </button>
  );
}
