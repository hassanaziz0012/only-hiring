"use client";

import { useEffect, useSyncExternalStore } from "react";
import { openAccountDialog } from "@/lib/account-dialog";
import { authClient } from "@/lib/auth-client";

// Whether this browser was signed in last time the session loaded. The label shows straight away
// from this guess instead of waiting about half a second for the session request, which painted
// the header late and held back Speed Index on every page.
const HINT_KEY = "only-hiring:signed-in";

function readHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

/** "Sign in", or "Account" once signed in. */
export function AccountNav() {
  const { data: session, isPending } = authClient.useSession();
  // False during server render and hydration, so the first client render matches the HTML.
  const hint = useSyncExternalStore(noSubscribe, readHint, () => false);
  const signedIn = isPending ? hint : Boolean(session);

  useEffect(() => {
    if (isPending) return;
    try {
      if (session) window.localStorage.setItem(HINT_KEY, "1");
      else window.localStorage.removeItem(HINT_KEY);
    } catch {}
  }, [isPending, session]);

  return (
    <button
      type="button"
      className="link tap"
      aria-haspopup="dialog"
      onClick={() => openAccountDialog(signedIn ? "account" : "signin")}
    >
      {signedIn ? "Account" : "Sign in"}
    </button>
  );
}
