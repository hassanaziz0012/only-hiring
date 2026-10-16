"use client";

import { useEffect, useId, useRef, useState } from "react";

type Status = "editing" | "sending" | "sent";

/** The header's "Feedback" link and the dialog it opens. Feedback is anonymous unless an email is given. */
export function FeedbackNav() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button type="button" className="link" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Feedback
      </button>
      <dialog
        ref={dialogRef}
        className="modal"
        aria-labelledby="feedback-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        {open && (
          <div className="p-6 md:p-8">
            <FeedbackForm onClose={() => setOpen(false)} />
          </div>
        )}
      </dialog>
    </>
  );
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>("editing");
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: form.get("message"),
        email: String(form.get("email") ?? "").trim(),
        website: form.get("website"),
        page: `${window.location.pathname}${window.location.search}`,
      }),
    }).catch(() => null);
    if (res?.ok) {
      setStatus("sent");
      return;
    }
    const data: { error?: string } | null = await res?.json().catch(() => null);
    setError(data?.error ?? "Couldn't send that. Check your connection and try again.");
    setStatus("editing");
  }

  if (status === "sent") {
    return (
      <>
        <div className="flex items-start justify-between gap-4">
          <h2 id="feedback-title" className="text-lead font-bold tracking-tight">
            Thanks, that&apos;s sent
          </h2>
          <CloseButton onClose={onClose} />
        </div>
        <p className="mt-2">Every message gets read, and it really does shape what changes next.</p>
        <button type="button" className="btn mt-6 w-full" onClick={onClose}>
          Done
        </button>
      </>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h2 id="feedback-title" className="text-lead font-bold tracking-tight">
          Send feedback
        </h2>
        <CloseButton onClose={onClose} />
      </div>
      <p className="mt-2">
        Something broken, missing or just good? Tell us. It&apos;s anonymous unless you leave an email.
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block" htmlFor={`${ids}-message`}>
          <span className="font-bold">Your feedback</span>
          <textarea
            id={`${ids}-message`}
            name="message"
            required
            maxLength={4000}
            rows={5}
            autoFocus
            className="field mt-1.5 block resize-y p-3"
          />
        </label>
        <label className="block" htmlFor={`${ids}-email`}>
          <span className="font-bold">Email</span>
          <span className="text-small text-muted"> (optional, if you&apos;d like a reply)</span>
          <input
            id={`${ids}-email`}
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            spellCheck={false}
            className="field mt-1.5 min-h-12 px-3"
          />
        </label>
        {/* Honeypot: hidden from people and screen readers, so only bots fill it in. */}
        <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <p role="alert" className={error ? "bg-pink p-3 text-pink-ink" : "sr-only"}>
          {error}
        </p>
        <button type="submit" className="btn w-full" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="btn btn-quiet -mt-1 -mr-2 text-small" onClick={onClose}>
      Close
    </button>
  );
}
