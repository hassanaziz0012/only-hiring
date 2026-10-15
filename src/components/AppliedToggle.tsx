"use client";

import { setApplied, useAppliedIds } from "@/lib/applied";

/** A checkbox, stored in this browser only. */
export function AppliedToggle({ id, title, size = "small" }: { id: string; title: string; size?: "small" | "large" }) {
  const applied = useAppliedIds().has(id);
  return (
    <label
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 font-bold transition-colors duration-150 select-none has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-(--focus) ${
        size === "large" ? "text-body" : "text-small"
      } ${applied ? "bg-mint text-mint-ink" : "text-ink hover:bg-surface"}`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={applied}
        onChange={(event) => setApplied(id, event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`grid size-4 flex-none place-items-center transition-colors duration-150 ${
          applied ? "bg-accent text-accent-ink" : "shadow-[inset_0_0_0_2px_currentColor]"
        }`}
      >
        {applied && (
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="square" />
          </svg>
        )}
      </span>
      Applied<span className="sr-only"> to {title}</span>
    </label>
  );
}
