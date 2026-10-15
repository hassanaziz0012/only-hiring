import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getJobs } from "@/lib/db";
import { countLabel } from "@/lib/format";
import { hasRemovalContact, RemovalContact } from "@/components/RemovalContact";
import { EXPIRY_DAYS, SCAM_HIDE_THRESHOLD, SCAM_WARN_THRESHOLD, SITE_NAME, SOURCE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works",
  description: `How ${SITE_NAME} finds genuine hiring posts on Reddit, scores scams, and what it doesn't store.`,
  alternates: { canonical: "/about" },
};

const STEPS = [
  {
    title: "Collect",
    body: "In the background, the site checks Reddit's hiring subreddits for new posts. Posts tagged [For Hire] or [Offer] are skipped straight away.",
  },
  {
    title: "Grade",
    body: "A language model reads each remaining post. It decides whether someone is actually hiring, writes a short summary, pulls out the pay, skills and location, and scores how likely the post is to be a scam.",
  },
  {
    title: "Publish",
    body: "Only hiring posts reach this site, and reposts are collapsed into one. Post bodies aren't stored: you see our summary and a link to the original, where you apply.",
  },
];

async function SubredditList() {
  const result = await getJobs();
  if (!result.ok || result.jobs.length === 0) return null;
  const counts = new Map<string, number>();
  for (const job of result.jobs) counts.set(job.subreddit, (counts.get(job.subreddit) ?? 0) + 1);
  const subs = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <section className="mt-28 md:mt-40" aria-labelledby="subs-title">
      <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="subs-title" className="head lowercase">
            where the posts come from
          </h2>
          <p className="mt-5 max-w-[42ch]">
            The subreddits behind the current list, with how many listed jobs each one has. The set changes as
            subreddits go quiet or new ones prove useful.
          </p>
        </div>
        <ul className="grid content-start gap-x-10 gap-y-3 sm:grid-cols-2 lg:col-span-8 xl:grid-cols-3">
          {subs.map(([sub, n]) => (
            <li key={sub} className="flex items-baseline justify-between gap-4 bg-surface px-4 py-3">
              <a
                href={`https://www.reddit.com/r/${encodeURIComponent(sub)}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="link min-w-0 truncate font-bold"
              >
                r/{sub}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span className="shrink-0 text-small text-muted tabular-nums">{countLabel(n, "job")}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="shell pt-10 pb-28 md:pt-16 md:pb-40">
        <h1 className="display">how it works</h1>
        <p className="mt-8 max-w-[36ch] text-lead md:mt-10">
          {SITE_NAME} collects posts from Reddit&apos;s hiring subreddits, keeps the ones that are hiring, and sends you
          back to Reddit to apply.
        </p>

        <section className="mt-20 md:mt-28" aria-labelledby="steps-title">
          <h2 id="steps-title" className="sr-only">
            The three steps
          </h2>
          <ol className="grid gap-x-12 gap-y-12 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3 className="text-lead font-bold">
                  <span className="bracketed">{step.title}</span>
                </h3>
                <p className="mt-3 max-w-[40ch]">{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-12 max-w-[64ch] text-muted">
            On a typical day about three in four posts on these subreddits are people offering their own services,
            discussion or spam. Those never appear here.
          </p>
        </section>

        <section
          className="mt-28 bg-accent p-6 text-accent-ink md:mt-40 md:p-14"
          aria-labelledby="scams-title"
        >
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
            <h2 id="scams-title" className="head lowercase lg:col-span-5">
              read the post before you reply
            </h2>
            <div className="space-y-10 lg:col-span-7">
              <div>
                <h3 className="text-lead font-bold">Scam scores</h3>
                <p className="mt-2 max-w-[56ch]">
                  Every post gets a score from 0 to 1. Signs that raise it include upfront fees, Telegram-only contact,
                  requests to rent your account, and payment in crypto. Posts scoring {SCAM_WARN_THRESHOLD} or more carry
                  a warning; posts scoring {SCAM_HIDE_THRESHOLD} or more are hidden unless you choose to see them.
                </p>
              </div>
              <div>
                <h3 className="text-lead font-bold">What the scores miss</h3>
                <p className="mt-2 max-w-[56ch]">
                  The model can be wrong in both directions, and so can the summaries and pay figures. Check the
                  original post, and never pay anyone or hand over ID to get a job.
                </p>
              </div>
            </div>
          </div>
        </section>

        <SubredditList />

        <section className="mt-28 md:mt-40" aria-labelledby="limits-title">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
            <h2 id="limits-title" className="head lowercase lg:col-span-4">
              good to know
            </h2>
            <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:col-span-8">
              <div>
                <h3 className="text-lead font-bold">Older posts</h3>
                <p className="mt-2">
                  Jobs posted more than {EXPIRY_DAYS} days ago move to a collapsed list at the bottom of the page. Many
                  are filled by then.
                </p>
              </div>
              <div>
                <h3 className="text-lead font-bold">Deleted posts</h3>
                <p className="mt-2">
                  If a post is deleted or removed on Reddit, it can stay listed here for a while and its link may go
                  nowhere.
                </p>
              </div>
              <div>
                <h3 className="text-lead font-bold">Pay</h3>
                <p className="mt-2">
                  Pay is shown in the currency the post used. Nothing is converted, so sorting by pay groups jobs by pay
                  type and currency.
                </p>
              </div>
              <div>
                <h3 className="text-lead font-bold">Your data</h3>
                <p className="mt-2">
                  No accounts, no tracking, no analytics. Jobs you mark as applied are saved in your browser and never
                  leave it.
                </p>
              </div>
              {hasRemovalContact() && (
                <div>
                  <h3 className="text-lead font-bold">Removal requests</h3>
                  <RemovalContact lead="Wrote one of these posts and want it gone?" />
                </div>
              )}
              <div>
                <h3 className="text-lead font-bold">Open source</h3>
                <p className="mt-2">
                  This website&apos;s code is open source under the MIT license
                  {SOURCE_URL ? (
                    <>
                      {" "}
                      (
                      <a className="link font-bold" href={SOURCE_URL}>
                        source
                      </a>
                      )
                    </>
                  ) : null}
                  . The job-collection pipeline isn&apos;t part of it.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Link href="/" className="btn mt-24">
          See all jobs
        </Link>
      </main>
    </>
  );
}
