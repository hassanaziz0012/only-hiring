"use client";

import { useEffect } from "react";
import { openAccountDialog, setSignedOut } from "@/lib/account-dialog";
import { connectAccount, disconnectAccount } from "@/lib/applied";
import { authClient } from "@/lib/auth-client";
import { publishSession, useAccountSession, useSessionEnabled } from "@/lib/session";
import { AccountDialog } from "./AccountDialog";

/** Mounted once in the root layout: keeps the applied marks in step with the session. */
export function AccountLayer({ googleEnabled }: { googleEnabled: boolean }) {
  const { data: session, isPending } = useAccountSession();
  const userId = session?.user.id ?? null;
  const fetchSession = useSessionEnabled();

  // A failed Google sign-in comes back as ?auth=google&error=<code> (see GoogleButton).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("auth") !== "google") return;
    const error = url.searchParams.get("error");
    url.searchParams.delete("auth");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState(null, "", url);
    if (error && error !== "access_denied") openAccountDialog("signin", googleErrorMessage(error));
  }, []);

  useEffect(() => {
    if (isPending) return;
    setSignedOut(!userId);
    if (userId) connectAccount(userId);
    else disconnectAccount();
  }, [userId, isPending]);

  return (
    <>
      {fetchSession && <SessionFetcher />}
      <AccountDialog googleEnabled={googleEnabled} />
    </>
  );
}

/** The only place that asks the server for the session, and only while it's enabled (see lib/session.ts). */
function SessionFetcher() {
  const { data, isPending } = authClient.useSession();
  useEffect(() => {
    publishSession({ data, isPending });
  }, [data, isPending]);
  return null;
}

function googleErrorMessage(code: string): string {
  if (code === "account_not_linked") {
    return "There's already an account with that Google account's email, made with a password. Sign in with your email and password instead.";
  }
  return "Signing in with Google didn't work. Try again, or use your email and password.";
}
