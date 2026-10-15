"use client";

import { exactDate, relativeTime } from "@/lib/format";
import { useMinuteClock } from "./board/hooks";

/** "3 hours ago" that stays current; renders against the snapshot time until hydrated. */
export function RelativeTime({ iso, fetchedAt }: { iso: string; fetchedAt: string }) {
  const clock = useMinuteClock();
  const now = clock ?? Date.parse(fetchedAt);
  return (
    <time dateTime={iso} title={exactDate(iso, clock == null ? "UTC" : undefined)}>
      {relativeTime(iso, now)}
    </time>
  );
}

/** "15 Oct 2026, 09:06" in the visitor's zone once hydrated (UTC before that). */
export function ExactTime({ iso }: { iso: string }) {
  const clock = useMinuteClock();
  const utc = clock == null;
  return (
    <time dateTime={iso}>
      {exactDate(iso, utc ? "UTC" : undefined)}
      {utc && " UTC"}
    </time>
  );
}
