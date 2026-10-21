"use client";

import { openAccountDialog } from "@/lib/account-dialog";
import { authClient } from "@/lib/auth-client";

/** "Sign in", or "Account" once signed in. Hidden (but still taking space) while the session loads. */
export function AccountNav() {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session);
  return (
    <button
      type="button"
      className={`link tap ${isPending ? "invisible" : ""}`}
      aria-haspopup="dialog"
      onClick={() => openAccountDialog(signedIn ? "account" : "signin")}
    >
      {signedIn ? "Account" : "Sign in"}
    </button>
  );
}
