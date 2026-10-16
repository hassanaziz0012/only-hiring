"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  closeAccountDialog,
  openAccountDialog,
  useAccountNotice,
  useAccountView,
  type AccountView,
} from "@/lib/account-dialog";
import { useAppliedIds } from "@/lib/applied";
import { authClient } from "@/lib/auth-client";
import { countLabel } from "@/lib/format";
import { showFilteredBoard } from "../board/hooks";

/** Sign up, sign in and the signed-in account summary, in one modal dialog. */
export function AccountDialog({ googleEnabled }: { googleEnabled: boolean }) {
  const view = useAccountView();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (view && !dialog.open) dialog.showModal();
    if (!view && dialog.open) dialog.close();
  }, [view]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="account-title"
      onClose={() => closeAccountDialog()}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAccountDialog();
      }}
    >
      {view && (
        <div className="p-6 md:p-8">
          {view === "account" ? <AccountSummary /> : <CredentialsForm key={view} view={view} googleEnabled={googleEnabled} />}
        </div>
      )}
    </dialog>
  );
}

function CredentialsForm({ view, googleEnabled }: { view: Exclude<AccountView, "account">; googleEnabled: boolean }) {
  const signingUp = view !== "signin";
  const localCount = useAppliedIds().size;
  const notice = useAccountNotice();
  const [error, setError] = useState<string | null>(notice);
  const [pending, setPending] = useState(false);
  const ids = useId();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    const { error } = signingUp
      ? await authClient.signUp.email({ email, password, name: email.split("@")[0] })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(errorMessage(error, signingUp, googleEnabled));
      return;
    }
    openAccountDialog("account");
  }

  const title = view === "prompt" ? "Save the jobs you apply to" : signingUp ? "Create an account" : "Sign in";

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h2 id="account-title" className="text-lead font-bold tracking-tight">
          {title}
        </h2>
        <CloseButton />
      </div>
      {view === "prompt" ? (
        <p className="mt-2">
          Your applied jobs are saved in this browser only, so clearing your browser data wipes them. Create a free
          account to keep them and see them on any device.
        </p>
      ) : (
        <p className="mt-2">
          {signingUp ? "Keep track of the jobs you apply to, on any device." : "Welcome back."}
          {localCount > 0 &&
            ` The ${countLabel(localCount, "job")} you marked in this browser will be added to your account.`}
        </p>
      )}

      {googleEnabled && (
        <>
          <GoogleButton disabled={pending} />
          <p className="mt-4 flex items-center gap-3 text-small text-muted" aria-hidden="true">
            <span className="h-0.5 flex-1 bg-surface-2" />
            or with email
            <span className="h-0.5 flex-1 bg-surface-2" />
          </p>
        </>
      )}

      <form className={googleEnabled ? "mt-4 space-y-4" : "mt-6 space-y-4"} onSubmit={submit}>
        <label className="block" htmlFor={`${ids}-email`}>
          <span className="font-bold">Email</span>
          <input
            id={`${ids}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            spellCheck={false}
            autoFocus={view !== "prompt" && !googleEnabled}
            className="field mt-1.5 min-h-12 px-3"
          />
        </label>
        <label className="block" htmlFor={`${ids}-password`}>
          <span className="font-bold">Password</span>
          {signingUp && <span className="text-small text-muted"> (at least 8 characters)</span>}
          <input
            id={`${ids}-password`}
            name="password"
            type="password"
            required
            minLength={signingUp ? 8 : undefined}
            maxLength={128}
            autoComplete={signingUp ? "new-password" : "current-password"}
            className="field mt-1.5 min-h-12 px-3"
          />
        </label>
        <p role="alert" className={error ? "bg-pink p-3 text-pink-ink" : "sr-only"}>
          {error}
        </p>
        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? "One moment…" : signingUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-body">
        <p>
          {signingUp ? "Already have an account? " : "New here? "}
          <button
            type="button"
            className="link font-bold"
            onClick={() => openAccountDialog(signingUp ? "signin" : "signup")}
          >
            {signingUp ? "Sign in" : "Create an account"}
          </button>
        </p>
        {view === "prompt" && (
          <button type="button" className="link text-muted" onClick={() => closeAccountDialog()}>
            Not now
          </button>
        )}
      </div>
    </>
  );
}

function AccountSummary() {
  const { data: session } = authClient.useSession();
  const count = useAppliedIds().size;
  // Set while confirming a delete. Google-only accounts have no password to confirm with.
  const [deleting, setDeleting] = useState<{ hasPassword: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordId = useId();

  if (!session) {
    return (
      <div className="flex items-start justify-between gap-4">
        <p id="account-title" className="text-lead font-bold">
          Loading your account…
        </p>
        <CloseButton />
      </div>
    );
  }

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    setPending(false);
    closeAccountDialog();
  }

  async function confirmDelete() {
    setPending(true);
    const { data: accounts } = await authClient.listAccounts();
    setPending(false);
    setError(null);
    setDeleting({ hasPassword: !accounts || accounts.some((a) => a.providerId === "credential") });
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    setPending(true);
    setError(null);
    // Without a password, better-auth only allows it if the user signed in within the last day.
    const { error } = await authClient.deleteUser(typeof password === "string" ? { password } : {});
    setPending(false);
    if (error) {
      setError(
        error.code === "SESSION_EXPIRED"
          ? "For safety, sign out and sign back in with Google first, then delete your account."
          : errorMessage(error, false, false),
      );
      return;
    }
    closeAccountDialog();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h2 id="account-title" className="text-lead font-bold tracking-tight">
          Your account
        </h2>
        <CloseButton />
      </div>
      <p className="mt-2 break-words text-muted">Signed in as {session.user.email}</p>

      <div className="mt-6 bg-mint p-5 text-mint-ink">
        <p className="text-lead font-bold tabular-nums">{countLabel(count, "job")} marked as applied</p>
        <p className="mt-1">Saved to your account, so they&apos;re safe from cleared browser data.</p>
        {count > 0 && (
          <Link
            href="/?applied=only#jobs"
            className="link mt-3 inline-block font-bold"
            onClick={(event) => {
              if (window.location.pathname === "/") {
                event.preventDefault();
                showFilteredBoard({ applied: "only" });
              }
              closeAccountDialog();
            }}
          >
            Show only those jobs
          </Link>
        )}
      </div>

      {deleting ? (
        <form className="mt-6 bg-pink p-5 text-pink-ink" onSubmit={deleteAccount}>
          <p className="font-bold">Delete your account?</p>
          <p className="mt-1">This deletes your account and your applied marks for good.</p>
          {deleting.hasPassword && (
            <label className="mt-4 block" htmlFor={passwordId}>
              <span className="font-bold">Password</span>
              <input
                id={passwordId}
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="field mt-1.5 min-h-12 bg-ground px-3"
              />
            </label>
          )}
          <p role="alert" className={error ? "mt-3 font-bold" : "sr-only"}>
            {error}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className="btn" disabled={pending}>
              Delete account
            </button>
            <button type="button" className="btn btn-quiet bg-ground" onClick={() => setDeleting(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn" onClick={signOut} disabled={pending}>
            Sign out
          </button>
          <button type="button" className="link text-body text-muted" onClick={confirmDelete} disabled={pending}>
            Delete account
          </button>
        </div>
      )}
    </>
  );
}

function GoogleButton({ disabled }: { disabled: boolean }) {
  const [redirecting, setRedirecting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setRedirecting(true);
    setFailed(false);
    const here = `${window.location.pathname}${window.location.search}`;
    // Marks saved in this browser stay in localStorage through the redirect, and are merged
    // into the account when the page loads signed in.
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: here,
      errorCallbackURL: `${window.location.pathname}?auth=google`,
    });
    if (error) {
      setRedirecting(false);
      setFailed(true);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-quiet mt-6 w-full" onClick={start} disabled={disabled || redirecting}>
        <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 flex-none">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {redirecting ? "Opening Google…" : "Continue with Google"}
      </button>
      {failed && (
        <p role="alert" className="mt-3 bg-pink p-3 text-pink-ink">
          Couldn&apos;t reach Google. Try again, or use your email and password.
        </p>
      )}
    </>
  );
}

function CloseButton() {
  return (
    <button type="button" className="btn btn-quiet -mt-1 -mr-2 text-small" onClick={() => closeAccountDialog()}>
      Close
    </button>
  );
}

function errorMessage(
  error: { status?: number; code?: string; message?: string },
  signingUp: boolean,
  googleEnabled: boolean,
): string {
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  switch (error.code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return googleEnabled
        ? "There's already an account with that email. Sign in instead, with Google if that's how you signed up."
        : "There's already an account with that email. Sign in instead.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match an account.";
    case "INVALID_PASSWORD":
      return "That password isn't right.";
    case "INVALID_EMAIL":
      return "That doesn't look like an email address.";
    case "PASSWORD_TOO_SHORT":
      return "Use a password of at least 8 characters.";
    case "PASSWORD_TOO_LONG":
      return "Use a password of at most 128 characters.";
  }
  return error.message || (signingUp ? "Couldn't create the account. Try again." : "Couldn't sign in. Try again.");
}
