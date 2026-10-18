import Link from "next/link";
import { formatPay } from "@/lib/format";
import { hasScamWarning, isLikelyScam, scamWarningLabel, type Job } from "@/lib/jobs";
import {
  APPLY_METHOD_LABELS,
  EMPLOYMENT_LABELS,
  labelFor,
  PAY_TYPE_LABELS,
  ROLE_LABELS,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
} from "@/lib/labels";
import { AppliedToggle } from "./AppliedToggle";
import { RedditLink } from "./RedditLink";
import { ScamScore, scoreText } from "./ScamScore";
import { ExactTime, RelativeTime } from "./RelativeTime";

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-small text-muted">{term}</dt>
      <dd className="mt-0.5 font-bold">{children}</dd>
    </div>
  );
}

/** A smaller, outlined link to Reddit, for the apply box's secondary actions. */
function SecondaryRedditLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <a
      className="inline-flex min-h-11 flex-1 items-center justify-center px-3 text-center text-small font-bold shadow-[inset_0_0_0_2px_currentColor] transition-colors duration-150 hover:bg-mint-ink hover:text-mint"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
      <span className="sr-only">
        {" "}
        ({detail}, opens in a new tab)
      </span>
    </a>
  );
}

export function JobDetail({ job, fetchedAt }: { job: Job; fetchedAt: string }) {
  const pay = formatPay(job);
  const warning = scamWarningLabel(job);
  const notStated = <span className="font-normal text-muted">Not stated</span>;
  // Only link names Reddit could have produced; deleted accounts show up as "[deleted]".
  const profileUrl = job.author && /^[\w-]+$/.test(job.author) ? `https://www.reddit.com/user/${job.author}` : null;
  const communityUrl = /^\w+$/.test(job.subreddit) ? `https://www.reddit.com/r/${job.subreddit}` : null;

  return (
    <div className="pt-4 pb-24 md:pt-8 md:pb-36">
      <Link href="/" className="link text-body">
        Back to all jobs
      </Link>

      <div className="mt-10 grid gap-x-16 gap-y-12 md:mt-14 lg:grid-cols-12">
        <article className="min-w-0 lg:col-span-8" aria-labelledby="job-title">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body text-muted">
            {job.postedAt && (
              <span className="bracketed font-bold text-accent">
                <RelativeTime iso={job.postedAt} fetchedAt={fetchedAt} />
              </span>
            )}
            <span>r/{job.subreddit}</span>
          </p>
          <h1 id="job-title" className="head mt-4 text-balance">
            {job.jobTitle}
          </h1>

          <p className={`mt-6 tabular-nums ${pay.stated ? "text-lead font-bold" : "text-body text-muted"}`}>{pay.text}</p>
          {job.payRaw && job.payRaw !== pay.text && (
            <p className="mt-1 text-body text-muted">As written in the post: &ldquo;{job.payRaw}&rdquo;</p>
          )}

          {warning && job.scamScore != null && (
            <section className="mt-10 flow-root bg-pink p-5 text-pink-ink md:p-7" aria-labelledby="scam-title">
              <ScamScore score={job.scamScore} />
              <h2 id="scam-title" className="text-lead font-bold">
                {warning}
              </h2>
              <p className="mt-2 max-w-[60ch]">
                Our grader scored this post {scoreText(job.scamScore)} on a scale from 0 (no warning signs) to 1 (almost
                certainly a scam).{" "}
                {isLikelyScam(job)
                  ? "It's hidden from the main list by default."
                  : "Be careful, and never pay to get a job."}
              </p>
              {job.redFlags.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {job.redFlags.map((flag, i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden="true" className="mt-[0.55em] size-2 flex-none bg-pink-deep" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {job.summary && <p className="mt-10 max-w-[62ch] text-lead text-pretty">{job.summary}</p>}

          {!hasScamWarning(job) && job.redFlags.length > 0 && (
            <section className="mt-10 bg-surface p-5 md:p-7" aria-labelledby="flags-title">
              <h2 id="flags-title" className="text-body font-bold">
                Worth checking before you reply
              </h2>
              <ul className="mt-3 space-y-1.5">
                {job.redFlags.map((flag, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.55em] size-2 flex-none bg-pink-deep" />
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <dl className="mt-12 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            <Fact term="Role">{labelFor(ROLE_LABELS, job.roleCategory) ?? notStated}</Fact>
            <Fact term="Seniority">{labelFor(SENIORITY_LABELS, job.seniority) ?? notStated}</Fact>
            <Fact term="Type of work">{labelFor(EMPLOYMENT_LABELS, job.employmentType) ?? notStated}</Fact>
            <Fact term="Work mode">{labelFor(WORK_MODE_LABELS, job.workMode) ?? notStated}</Fact>
            <Fact term="Location">{job.location ?? notStated}</Fact>
            <Fact term="Pay type">{labelFor(PAY_TYPE_LABELS, job.payType) ?? notStated}</Fact>
            <Fact term="How to apply">{labelFor(APPLY_METHOD_LABELS, job.applyMethod) ?? notStated}</Fact>
            {job.postedAt && (
              <Fact term="Posted">
                <ExactTime iso={job.postedAt} />
              </Fact>
            )}
          </dl>

          {job.skills.length > 0 && (
            <section className="mt-12" aria-labelledby="skills-title">
              <h2 id="skills-title" className="text-body font-bold">
                Skills
              </h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {job.skills.map((skill, i) => (
                  <li key={i} className="chip">
                    {skill}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-16" aria-labelledby="original-title">
            <h2 id="original-title" className="text-body font-bold">
              The original post
            </h2>
            <blockquote className="mt-3 max-w-[62ch]">
              <p className="text-lead">&ldquo;{job.redditTitle}&rdquo;</p>
              {job.bodyExcerpt && <p className="mt-2 line-clamp-3">{job.bodyExcerpt}</p>}
            </blockquote>
            <p className="mt-3 text-body text-muted">
              {job.author ? <>Posted by u/{job.author}</> : "Posted"} in r/{job.subreddit}
              {job.flair && <>, flaired &ldquo;{job.flair}&rdquo;</>}.
            </p>
          </section>
        </article>

        <aside className="lg:col-span-4" aria-label="Apply">
          <div className="bg-mint p-6 text-mint-ink lg:sticky lg:top-6 md:p-8">
            <p className="text-lead font-bold">Apply on Reddit</p>
            <p className="mt-2">
              {job.applyMethod ? `${labelFor(APPLY_METHOD_LABELS, job.applyMethod)}.` : "The post explains how to apply."} Read
              the full post first.
            </p>
            <RedditLink className="btn mt-6 w-full" href={job.redditUrl} />
            {(profileUrl || communityUrl) && (
              <div className="mt-2 flex gap-2">
                {profileUrl && <SecondaryRedditLink href={profileUrl} label="View user profile" detail={`u/${job.author}`} />}
                {communityUrl && (
                  <SecondaryRedditLink href={communityUrl} label="View community" detail={`r/${job.subreddit}`} />
                )}
              </div>
            )}
            <div className="mt-3">
              <AppliedToggle id={job.id} title={job.jobTitle} size="large" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
