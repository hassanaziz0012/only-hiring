import type { Metadata } from "next";
import Link from "next/link";
import { DataError } from "@/components/DataError";
import { JobRow, StatTile } from "@/components/JobRow";
import { ProseSection } from "@/components/ProseSection";
import { ExactTime } from "@/components/RelativeTime";
import { SiteHeader } from "@/components/SiteHeader";
import { CATEGORIES, categoryLive, isCategoryIndexable, type CategoryLive, type CategoryProfile } from "@/lib/categories";
import { getJobs } from "@/lib/db";
import { countLabel, workModeText } from "@/lib/format";
import { categoryGraph, JsonLd } from "@/lib/jsonld";
import { EMPLOYMENT_LABELS, labelFor, ROLE_LABELS } from "@/lib/labels";
import { SCAM_GUIDE_PATH } from "@/lib/scam-report";
import { EXPIRY_DAYS, LIST_WINDOW_DAYS, SITE_NAME } from "@/lib/site";
import { BEST_SUBS_PATH, subredditPath, subredditProfile } from "@/lib/subreddits";

// Shared by /remote and /roles/[role]: the same page, with each category's copy and figures.

const pageTitle = (cat: CategoryProfile) => `${cat.name} from Reddit: hiring posts only`;

function description(cat: CategoryProfile, open: number): string {
  const lead = `${countLabel(open, `open ${cat.noun.replace(/s$/, "")}`, `open ${cat.noun}`)} from Reddit's job subreddits, scam-checked.`;
  const full = `${lead} ${cat.blurb}`;
  return full.length > 200 ? lead : full;
}

export async function categoryMetadata(cat: CategoryProfile): Promise<Metadata> {
  const result = await getJobs();
  const live = result.ok ? categoryLive(result.jobs, cat, Date.parse(result.fetchedAt)) : null;
  const desc = description(cat, live?.open.length ?? 0);
  const title = pageTitle(cat);
  return {
    title,
    description: desc,
    alternates: { canonical: cat.path },
    // A near-empty list is a filtered copy of the homepage, not worth a search result.
    ...(live && isCategoryIndexable(live) ? {} : { robots: { index: false, follow: true } }),
    // A page-level openGraph replaces the inherited one. The image comes from opengraph-image.tsx.
    openGraph: { type: "website", siteName: SITE_NAME, title, description: desc, url: cat.path, locale: "en_GB" },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

const pct = (part: number, whole: number) => `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;

function SubLink({ name }: { name: string }) {
  return subredditProfile(name) ? (
    <Link href={subredditPath(name)} className="link">
      r/{name}
    </Link>
  ) : (
    <>r/{name}</>
  );
}

function Chips({ label, items }: { label: string; items: [string, number][] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {items.map(([name, n]) => (
        <li key={name} className="chip">
          {name} <span className="ml-1.5 text-muted tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

function Numbers({ cat, live }: { cat: CategoryProfile; live: CategoryLive }) {
  const n = live.open.length;
  const remote = cat.role === null;
  return (
    <ProseSection id="numbers" title="By the numbers">
      <ul className="grid grid-cols-2 gap-3">
        <StatTile value={n} label="open jobs right now" />
        {n > 0 && <StatTile value={pct(live.payStated, n)} label="name an amount" />}
        {remote
          ? n > 0 && <StatTile value={pct(live.worldwide, n)} label="say anyone, anywhere can apply" />
          : n > 0 && <StatTile value={pct(live.remote, n)} label="are remote" />}
        {live.pay && <StatTile value={live.pay.text} label={`median pay, from ${live.pay.n} posts`} />}
      </ul>
      {n > 0 && (
        <p>
          {remote ? (
            <>
              Of the {countLabel(n, "open remote job")}, {live.worldwide} {live.worldwide === 1 ? "is" : "are"} open
              worldwide and {live.restricted} only to people in certain countries. The rest don&apos;t say.{" "}
            </>
          ) : (
            <>
              {live.payStated} of the {countLabel(n, "open job")} name an amount and {live.remote}{" "}
              {live.remote === 1 ? "is" : "are"} remote.{" "}
            </>
          )}
          {live.warned === 0
            ? "None carry a scam warning."
            : `${live.warned} ${live.warned === 1 ? "carries" : "carry"} a scam warning.`}
          {live.hidden > 0 && ` ${countLabel(live.hidden, "likely scam")} ${live.hidden === 1 ? "is" : "are"} hidden.`}
        </p>
      )}
      {live.pay && (
        <p>
          The median is over the {live.pay.n} posts from the last {LIST_WINDOW_DAYS} days that gave {live.pay.per} in US
          dollars, likely scams left out. Small samples move a lot, so treat it as a rough guide.
        </p>
      )}
      {remote && live.regions.length > 0 && (
        <>
          <p>Where the restricted jobs are open to:</p>
          <Chips label="Countries and regions" items={live.regions} />
        </>
      )}
      {remote && live.roles.length > 0 && (
        <>
          <p>Open remote jobs by role:</p>
          <Chips label="Open jobs by role" items={live.roles} />
        </>
      )}
      {live.skills.length > 0 && (
        <>
          <p>Skills the open jobs ask for most:</p>
          <Chips label="Skills" items={live.skills} />
        </>
      )}
    </ProseSection>
  );
}

export async function CategoryPage({ cat }: { cat: CategoryProfile }) {
  const result = await getJobs();
  const live = result.ok ? categoryLive(result.jobs, cat, Date.parse(result.fetchedAt)) : null;
  const others = CATEGORIES.filter((c) => c.slug !== cat.slug);

  return (
    <>
      <SiteHeader />
      <main id="main" className="shell pt-6 pb-28 md:pt-10 md:pb-40">
        <Link href="/" className="link tap text-body">
          Back to all jobs
        </Link>

        <h1 className="mt-10 md:mt-14">
          <span className="display block lowercase">{cat.noun}</span>
          <span className="mt-4 block text-lead font-bold">from Reddit, hiring posts only</span>
        </h1>
        <p className="mt-6 max-w-[48ch] text-lead md:mt-8">{cat.blurb}</p>
        {result.ok && result.syncedAt && (
          <p className="mt-4 text-body text-muted">
            Updated <ExactTime iso={result.syncedAt} />.
          </p>
        )}

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
                  ? `${countLabel(live.open.length, "hiring post")} from the last ${EXPIRY_DAYS} days, newest first.`
                  : `No open ${cat.noun} from the last ${EXPIRY_DAYS} days.`}
                {live.nsfw > 0 && ` ${countLabel(live.nsfw, "adult post")} ${live.nsfw === 1 ? "isn't" : "aren't"} listed here.`}
              </p>
              {live.open.length > 0 && (
                <ul className="mt-6 border-b-2 border-surface-2">
                  {live.open.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      facets={[
                        `r/${job.subreddit}`,
                        cat.role ? null : labelFor(ROLE_LABELS, job.roleCategory),
                        labelFor(EMPLOYMENT_LABELS, job.employmentType),
                        workModeText(job, 3),
                      ]}
                    />
                  ))}
                </ul>
              )}
              <p className="mt-6">
                <Link href={cat.boardHref} className="link font-bold">
                  Filter these on the board
                </Link>
              </p>
            </>
          )}
        </section>

        <div className="mt-24 space-y-14 md:mt-32">
          <ProseSection id="about" title={`About ${cat.noun} on Reddit`}>
            {cat.about.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            {live && live.subs.length > 0 && (
              <p>
                Where the open ones were posted:{" "}
                {live.subs.map(([name, n], i) => (
                  <span key={name}>
                    {i > 0 && ", "}
                    <SubLink name={name} /> ({n})
                  </span>
                ))}
                .
              </p>
            )}
          </ProseSection>

          {live && <Numbers cat={cat} live={live} />}

          <ProseSection id="tips" title="Before you apply">
            <ul className="list-disc space-y-2 pl-5">
              {cat.tips.map((tip, i) => (
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

          <ProseSection id="more" title="More from Reddit">
            <ul className="space-y-5">
              {others.map((c) => (
                <li key={c.slug}>
                  <Link href={c.path} className="link font-bold">
                    {c.name}
                  </Link>
                  <p className="mt-1">{c.blurb}</p>
                </li>
              ))}
            </ul>
            <p>
              <Link href={BEST_SUBS_PATH} className="link font-bold">
                The best subreddits for jobs
              </Link>{" "}
              compares every subreddit we read.
            </p>
          </ProseSection>
        </div>
      </main>
      {live && (
        <JsonLd
          data={categoryGraph({ path: cat.path, name: cat.name, description: description(cat, live.open.length), jobs: live.open })}
        />
      )}
    </>
  );
}
