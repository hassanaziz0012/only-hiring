import Link from "next/link";
import { exactDate, formatPay, relativeTime, shortAge } from "@/lib/format";
import { scamWarningLabel, type Job } from "@/lib/jobs";
import { EMPLOYMENT_LABELS, labelFor, ROLE_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS } from "@/lib/labels";
import { AppliedToggle } from "./AppliedToggle";

const MAX_SKILLS = 4;

export function JobAge({ postedAt, now, timeZone }: { postedAt: string | null; now: number; timeZone?: string }) {
  if (!postedAt) {
    return (
      <span className="bracketed font-bold text-muted" title="Post date unknown">
        ?
      </span>
    );
  }
  return (
    <time dateTime={postedAt} title={exactDate(postedAt, timeZone)} className="font-bold whitespace-nowrap text-accent">
      <span className="bracketed" aria-hidden="true">
        {shortAge(postedAt, now)}
      </span>
      <span className="sr-only">Posted {relativeTime(postedAt, now)}</span>
    </time>
  );
}

export function JobItem({
  job,
  now,
  timeZone,
  applied,
  headingLevel = 3,
}: {
  job: Job;
  now: number;
  timeZone?: string;
  applied: boolean;
  headingLevel?: 2 | 3;
}) {
  const pay = formatPay(job);
  const warning = scamWarningLabel(job);
  const facets = [
    labelFor(ROLE_LABELS, job.roleCategory),
    labelFor(SENIORITY_LABELS, job.seniority),
    labelFor(EMPLOYMENT_LABELS, job.employmentType),
    labelFor(WORK_MODE_LABELS, job.workMode),
    job.location,
  ].filter((v): v is string => Boolean(v));
  const skills = job.skills.slice(0, MAX_SKILLS);
  const moreSkills = job.skills.length - skills.length;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article
      aria-labelledby={`job-${job.id}`}
      className={`relative md:pl-24 transition-opacity duration-200 ${applied ? "opacity-60 hover:opacity-100 focus-within:opacity-100" : ""}`}
    >
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-small text-muted">
        <span className="text-body md:absolute md:top-0 md:left-0">
          <JobAge postedAt={job.postedAt} now={now} timeZone={timeZone} />
        </span>
        <span>r/{job.subreddit}</span>
        {applied && <span className="font-bold text-ink">You applied</span>}
      </p>

      <div className="mt-1 flex flex-col gap-x-8 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between">
        <Heading id={`job-${job.id}`} className="text-lead font-bold tracking-[-0.02em] text-balance">
          <Link href={`/jobs/${job.id}`} className="decoration-accent decoration-[0.08em] underline-offset-[0.18em] hover:underline">
            {job.jobTitle}
          </Link>
        </Heading>
        <p
          className={`shrink-0 tabular-nums sm:text-right ${pay.stated ? "text-body font-bold" : "text-small text-muted"}`}
          title={job.payRaw ? `As written in the post: ${job.payRaw}` : undefined}
        >
          {pay.text}
        </p>
      </div>

      {job.summary && <p className="mt-2 max-w-[68ch] text-pretty">{job.summary}</p>}

      {(warning || facets.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Details">
          {warning && (
            <li className="chip chip-warn">
              <span>{warning}</span>
            </li>
          )}
          {facets.map((facet, i) => (
            <li key={i} className="chip" title={facet.length > 40 ? facet : undefined}>
              <span className="chip-text max-w-[28ch]">{facet}</span>
            </li>
          ))}
        </ul>
      )}

      {skills.length > 0 && (
        <p className="mt-2 text-small text-muted">
          <span className="sr-only">Skills: </span>
          {skills.join(", ")}
          {moreSkills > 0 && <span className="text-ink"> +{moreSkills} more</span>}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a className="btn text-small" href={job.redditUrl} target="_blank" rel="noopener noreferrer">
          View on Reddit
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <AppliedToggle id={job.id} title={job.jobTitle} />
      </div>
    </article>
  );
}
