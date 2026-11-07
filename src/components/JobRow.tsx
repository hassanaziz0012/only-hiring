import Link from "next/link";
import { formatPay } from "@/lib/format";
import { scamWarningLabel, type Job } from "@/lib/jobs";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** One job in the plain lists on subreddit and category pages: date, title, details and pay. */
export function JobRow({ job, facets }: { job: Job; facets: (string | null)[] }) {
  const pay = formatPay(job);
  const warning = scamWarningLabel(job);
  const shown = facets.filter((v): v is string => Boolean(v));

  return (
    <li className="grid gap-x-6 gap-y-2 border-t-2 border-surface-2 py-5 sm:grid-cols-[4.5rem_1fr_auto] sm:items-baseline">
      <p className="text-small text-muted tabular-nums">
        {job.postedAt ? <time dateTime={job.postedAt}>{DAY.format(new Date(job.postedAt))}</time> : "Undated"}
      </p>
      <div className="min-w-0">
        <h3 className="text-lead font-bold tracking-[-0.02em] text-balance">
          <Link href={`/jobs/${job.id}`} className="tap decoration-accent decoration-[0.08em] underline-offset-[0.18em] hover:underline">
            {job.jobTitle}
          </Link>
        </h3>
        {(warning || shown.length > 0) && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Details">
            {warning && <li className="chip chip-warn">{warning}</li>}
            {shown.map((facet) => (
              <li key={facet} className="chip">
                {facet}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className={`tabular-nums sm:text-right ${pay.stated ? "font-bold" : "text-small text-muted"}`}>{pay.text}</p>
    </li>
  );
}

/** A big figure with a label, for the "By the numbers" grids. */
export function StatTile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <li className="bg-surface px-5 py-6">
      <span className="block text-[clamp(2rem,5vw,3.25rem)] leading-none font-bold tabular-nums">{value}</span>
      <span className="mt-3 block">{label}</span>
    </li>
  );
}
