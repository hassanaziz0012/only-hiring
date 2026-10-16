"use client";

import { promptSignUp } from "@/lib/account-dialog";

/** Opens the post on Reddit in a new tab. That's how people apply, so it can trigger the sign-up nudge. */
export function RedditLink({ href, className }: { href: string; className?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={() => promptSignUp()}>
      View on Reddit
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
