import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { DataError } from "@/components/DataError";
import { ProseSection } from "@/components/ProseSection";
import { ExactTime } from "@/components/RelativeTime";
import { SiteHeader } from "@/components/SiteHeader";
import { getJobs } from "@/lib/db";
import { countLabel, formatPay } from "@/lib/format";
import { scamWarningLabel, type Job } from "@/lib/jobs";
import { JsonLd, subredditGraph } from "@/lib/jsonld";
import { EMPLOYMENT_LABELS, labelFor, ROLE_LABELS, WORK_MODE_LABELS } from "@/lib/labels";
import { SCAM_GUIDE_PATH } from "@/lib/scam-report";
import { EXPIRY_DAYS, SITE_NAME } from "@/lib/site";
import {
  BEST_SUBS_PATH,
  isSubredditIndexable,
  subredditLive,
  subredditPath,
  subredditProfile,
  SUBREDDITS,
  typicalPay,
  type SubredditProfile,
} from "@/lib/subreddits";

// Same as job pages: the whole page is static, so an unknown subreddit can still answer 404.
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return SUBREDDITS.map((s) => ({ sub: s.slug }));
}

const pageTitle = (name: string) => `r/${name} jobs: hiring posts only`;

function description(profile: SubredditProfile, open: number): string {
  const lead = `${countLabel(open, "open hiring post")} from r/${profile.name}, without the [For Hire] posts and spam.`;
  const full = `${lead} ${profile.blurb}`;
  return full.length > 200 ? lead : full;
}

export async function generateMetadata({ params }: PageProps<"/r/[sub]">): Promise<Metadata> {
  const { sub } = await params;
  const profile = subredditProfile(sub);
  if (!profile || profile.slug !== sub) return { title: "Subreddit not found", robots: { index: false } };
  const result = await getJobs();
  const live = result.ok ? subredditLive(result.jobs, profile.name, Date.parse(result.fetchedAt)) : null;
  const desc = description(profile, live?.open.length ?? 0);
  const title = pageTitle(profile.name);
  const path = subredditPath(profile.name);
  return {
    title,
    description: desc,
    alternates: { canonical: path },
    // A near-empty list isn't worth a search result; the page still links its jobs.
    ...(live && isSubredditIndexable(live) ? {} : { robots: { index: false, follow: true } }),
    // A page-level openGraph replaces the inherited one. The image comes from opengraph-image.tsx.
    openGraph: { type: "website", siteName: SITE_NAME, title, description: desc, url: path, locale: "en_GB" },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

const pct = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function JobRow({ job }: { job: Job }) {
  const pay = formatPay(job);
  const warning = scamWarningLabel(job);
  const facets = [
    labelFor(ROLE_LABELS, job.roleCategory),
    labelFor(EMPLOYMENT_LABELS, job.employmentType),
    labelFor(WORK_MODE_LABELS, job.workMode),
  ].filter((v): v is string => Boolean(v));

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
        {(warning || facets.length > 0) && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Details">
            {warning && <li className="chip chip-warn">{warning}</li>}
            {facets.map((facet) => (
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

function Tile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <li className="bg-surface px-5 py-6">
      <span className="block text-[clamp(2rem,5vw,3.25rem)] leading-none font-bold tabular-nums">{value}</span>
      <span className="mt-3 block">{label}</span>
    </li>
  );
}

/** What the posts that weren't hiring were, leaving out the kinds with none. */
function noiseBreakdown(s: SubredditProfile["snapshot"]): string {
  const parts = [
    [s.discussion, "question or discussion post", "questions or discussion posts"],
    [s.forHire, "person offering their services without the tag", "people offering their services without the tag"],
    [s.spam, "spam or promotional post", "spam or promotional posts"],
    [s.unpaid, "unpaid collaboration", "unpaid collaborations"],
    [s.other, "post of another kind", "posts of other kinds"],
  ] as const;
  const named = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (named.length === 0) return "";
  const list = named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`;
  return ` The others: ${list}.`;
}

export default async function SubredditPage({ params }: PageProps<"/r/[sub]">) {
  const { sub } = await params;
  const profile = subredditProfile(sub);
  if (!profile) notFound();
  // Reddit's own spelling, like /r/gameDevClassifieds, goes to the lowercase URL.
  if (profile.slug !== sub) permanentRedirect(subredditPath(profile.name));

  const result = await getJobs();
  const now = result.ok ? Date.parse(result.fetchedAt) : 0;
  const live = result.ok ? subredditLive(result.jobs, profile.name, now) : null;
  const s = profile.snapshot;
  const pay = typicalPay(s);
  const name = `r/${profile.name}`;
  const redditUrl = `https://www.reddit.com/r/${profile.name}/`;
  const related = profile.related.map(subredditProfile).filter((p): p is SubredditProfile => Boolean(p));

  return (
    <>
      <SiteHeader />
      <main id="main" className="shell pt-6 pb-28 md:pt-10 md:pb-40">
        <Link href={BEST_SUBS_PATH} className="link tap text-body">
          All job subreddits
        </Link>

        <h1 className="mt-10 md:mt-14">
          {/* Sized to the name, so the longest subreddit names still fit on one line on a phone. */}
          <span
            className="display block"
            style={{ fontSize: `min(var(--text-display), calc((100vw - 2.5rem) / ${(name.length * 0.46).toFixed(2)}))` }}
          >
            {name}
          </span>
          <span className="mt-4 block text-lead font-bold">hiring posts only</span>
        </h1>
        <p className="mt-6 max-w-[48ch] text-lead md:mt-8">{profile.blurb}</p>
        <p className="mt-4 text-body text-muted">
          {result.ok && result.syncedAt && (
            <>
              Updated <ExactTime iso={result.syncedAt} />.{" "}
            </>
          )}
          <a className="link" href={redditUrl} target="_blank" rel="noopener noreferrer">
            {name} on Reddit
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>

        <section className="mt-14 md:mt-20" aria-labelledby="open-title">
          <h2 id="open-title" className="head lowercase">
            open jobs
          </h2>
          {!live ? (
            <DataError />
          ) : (
            <>
              <p className="mt-4 max-w-[60ch] text-muted">
                {live.open.length > 0
                  ? `${countLabel(live.open.length, "hiring post")} from ${name} in the last ${EXPIRY_DAYS} days, newest first.`
                  : `No open hiring posts from ${name} in the last ${EXPIRY_DAYS} days. It can be quiet for weeks at a time.`}
                {live.hidden > 0 && ` ${countLabel(live.hidden, "likely scam")} ${live.hidden === 1 ? "is" : "are"} hidden.`}
                {live.nsfw > 0 && ` ${countLabel(live.nsfw, "adult post")} ${live.nsfw === 1 ? "isn't" : "aren't"} listed here.`}
              </p>
              {live.open.length > 0 && (
                <ul className="mt-6 border-b-2 border-surface-2">
                  {live.open.map((job) => (
                    <JobRow key={job.id} job={job} />
                  ))}
                </ul>
              )}
              <p className="mt-6">
                <Link href="/" className="link font-bold">
                  Jobs from every subreddit
                </Link>
              </p>
            </>
          )}
        </section>

        <div className="mt-24 space-y-14 md:mt-32">
          <ProseSection id="about" title={`About ${name}`}>
            {profile.about.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </ProseSection>

          <ProseSection id="numbers" title="By the numbers">
            <ul className="grid grid-cols-2 gap-3">
              <Tile value={pct(s.hiring, s.graded)} label="of the posts we read were hiring" />
              <Tile value={pct(s.payStated, s.hiring)} label="of hiring posts named an amount" />
              {pay && <Tile value={pay.text} label={`median pay, from ${pay.n} posts`} />}
              {live && <Tile value={live.open.length} label="open jobs right now" />}
            </ul>
            <p>
              Of the {s.graded} posts we read from {name} in October 2026, {s.hiring} were hiring.{noiseBreakdown(s)}{" "}
              Posts tagged [For Hire] or [Offer] were skipped before we read anything, so they aren&apos;t counted.
            </p>
            {pay && (
              <p>
                The median is over posts that gave a {pay.hourly ? "US-dollar hourly rate" : "US-dollar price for the whole job"}.
                Small samples move a lot, so treat it as a rough guide.
              </p>
            )}
            {live && live.open.length > 0 && (
              <>
                <p>
                  Right now: {live.payStated} of the {countLabel(live.open.length, "open job")} name an amount,{" "}
                  {live.remote} {live.remote === 1 ? "is" : "are"} remote, and{" "}
                  {live.warned === 0 ? "none carry" : `${live.warned} ${live.warned === 1 ? "carries" : "carry"}`} a scam
                  warning.
                </p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Open jobs by role">
                  {live.roles.map(([role, n]) => (
                    <li key={role} className="chip">
                      {role} <span className="ml-1.5 text-muted tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ProseSection>

          <ProseSection id="tips" title="Before you apply here">
            <ul className="list-disc space-y-2 pl-5">
              {profile.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
            <p>
              And everywhere on Reddit: read the whole post and its comments, and never pay to get a job. Our{" "}
              <Link href={SCAM_GUIDE_PATH} className="link font-bold">
                guide to Reddit job scams
              </Link>{" "}
              has the warning signs we see most.
            </p>
          </ProseSection>

          {related.length > 0 && (
            <ProseSection id="related" title="Similar subreddits">
              <ul className="space-y-5">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={subredditPath(r.name)} className="link font-bold">
                      r/{r.name}
                    </Link>
                    <p className="mt-1">{r.blurb}</p>
                  </li>
                ))}
              </ul>
              <p>
                <Link href={BEST_SUBS_PATH} className="link font-bold">
                  The best subreddits for jobs
                </Link>{" "}
                compares all {SUBREDDITS.length} that we read.
              </p>
            </ProseSection>
          )}
        </div>
      </main>
      {live && (
        <JsonLd
          data={subredditGraph({
            path: subredditPath(profile.name),
            name: profile.name,
            description: description(profile, live.open.length),
            guide: { path: BEST_SUBS_PATH, name: "Best subreddits for jobs" },
            jobs: live.open,
          })}
        />
      )}
    </>
  );
}
