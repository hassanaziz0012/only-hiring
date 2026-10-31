import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getJobs } from "@/lib/db";
import { countLabel } from "@/lib/format";
import { SCAM_GUIDE_PATH } from "@/lib/scam-report";
import { BEST_SUBS_PATH, subredditPath, subredditProfile } from "@/lib/subreddits";
import { hasRemovalContact, RemovalContact } from "@/components/RemovalContact";
import {
  EXPIRY_DAYS,
  MAKER,
  removalEmail,
  SCAM_HIDE_THRESHOLD,
  SCAM_WARN_THRESHOLD,
  SITE_NAME,
  SOURCE_URL,
  siteUrl,
} from "@/lib/site";

const MCP_URL = new URL("/mcp", siteUrl()).toString();

const description = `How ${SITE_NAME} finds genuine hiring posts on Reddit, scores scams, and what it doesn't store.`;

export const metadata: Metadata = {
  title: "How it works",
  description,
  alternates: { canonical: "/about" },
  // A page-level openGraph replaces the inherited one, so the shared fields are listed again.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `How ${SITE_NAME} works`,
    description,
    url: "/about",
    locale: "en_GB",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", title: `How ${SITE_NAME} works`, description, images: ["/opengraph-image"] },
};

const STEPS = [
  {
    title: "Collect",
    body: "In the background, the site checks Reddit's hiring subreddits for new posts. Posts tagged [For Hire] or [Offer] are skipped straight away.",
  },
  {
    title: "Grade",
    body: "Posts that are clearly not hiring, such as interview questions, are set aside first by a simple classifier trained on earlier grades. A language model reads each remaining post. It decides whether someone is actually hiring, writes a short summary, pulls out the pay, skills and location, and scores how likely the post is to be a scam.",
  },
  {
    title: "Publish",
    body: "Only hiring posts reach this site, and reposts are collapsed into one. We keep only a post's opening lines: you see our summary and a link to the original, where you apply.",
  },
];

/** Listed jobs per subreddit, busiest first. Empty when the jobs can't be read. */
async function subredditCounts(): Promise<[string, number][]> {
  const result = await getJobs();
  if (!result.ok) return [];
  const counts = new Map<string, number>();
  for (const job of result.jobs) counts.set(job.subreddit, (counts.get(job.subreddit) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** The sections below the scam card, in page order. Each id is the section's anchor. */
const CONTENTS = [
  { id: "subreddits", title: "where the posts come from", blurb: "The subreddits we read, and how many jobs each has." },
  { id: "good-to-know", title: "good to know", blurb: "Older and deleted posts, pay, your data, removals." },
  { id: "ai-assistants", title: "use it in claude or chatgpt", blurb: "Search these jobs from your AI assistant." },
  { id: "who-makes-this", title: "who makes this", blurb: "Who built the site, why, and how to get in touch." },
] as const;

function Contents({ hasSubreddits }: { hasSubreddits: boolean }) {
  const items = CONTENTS.filter((item) => hasSubreddits || item.id !== "subreddits");
  return (
    <nav className="mt-16 md:mt-20" aria-labelledby="contents-title">
      <div className="grid gap-x-16 gap-y-6 lg:grid-cols-12">
        <h2 id="contents-title" className="text-lead font-bold lg:col-span-4">
          <span className="bracketed">Also on this page</span>
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="group flex h-full items-baseline gap-4 bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block font-bold lowercase underline decoration-[0.08em] underline-offset-[0.18em] transition-[text-decoration-color] group-hover:decoration-accent">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-small text-muted">{item.blurb}</span>
                </span>
                <span aria-hidden="true" className="ml-auto shrink-0 text-muted transition-transform group-hover:translate-y-0.5">
                  ↓
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function SubredditList({ subs }: { subs: [string, number][] }) {
  if (subs.length === 0) return null;

  return (
    <section id="subreddits" className="mt-28 scroll-mt-10 md:mt-40" aria-labelledby="subs-title">
      <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="subs-title" className="head lowercase">
            where the posts come from
          </h2>
          <p className="mt-5 max-w-[42ch]">
            The subreddits behind the current list, with how many listed jobs each one has. The set changes as
            subreddits go quiet or new ones prove useful. Each has a page describing what gets posted there, and{" "}
            <Link href={BEST_SUBS_PATH} className="link font-bold">
              the best subreddits for jobs
            </Link>{" "}
            compares them.
          </p>
        </div>
        <ul className="grid content-start gap-x-10 gap-y-3 sm:grid-cols-2 lg:col-span-8 xl:grid-cols-3">
          {subs.map(([sub, n]) => (
            <li key={sub} className="flex items-baseline justify-between gap-4 bg-surface px-4 py-3">
              {subredditProfile(sub) ? (
                <Link href={subredditPath(sub)} className="link min-w-0 truncate font-bold">
                  r/{sub}
                </Link>
              ) : (
                <a
                  href={`https://www.reddit.com/r/${encodeURIComponent(sub)}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link min-w-0 truncate font-bold"
                >
                  r/{sub}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <span className="shrink-0 text-small text-muted tabular-nums">{countLabel(n, "job")}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default async function AboutPage() {
  const subs = await subredditCounts();

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
                  and requests to rent your account. Posts scoring {SCAM_WARN_THRESHOLD} or more carry
                  a warning; posts scoring {SCAM_HIDE_THRESHOLD} or more are hidden unless you choose to see them.
                </p>
              </div>
              <div>
                <h3 className="text-lead font-bold">What the scores miss</h3>
                <p className="mt-2 max-w-[56ch]">
                  The model can be wrong in both directions, and so can the summaries and pay figures. Check the
                  original post, and never pay anyone or hand over ID to get a job. Our{" "}
                  <Link href={SCAM_GUIDE_PATH} className="link font-bold">
                    guide to Reddit job scams
                  </Link>{" "}
                  covers the warning signs we see most.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Contents hasSubreddits={subs.length > 0} />

        <SubredditList subs={subs} />

        <section id="good-to-know" className="mt-28 scroll-mt-10 md:mt-40" aria-labelledby="limits-title">
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
                  If a post is deleted or removed on Reddit, it comes off this site the next time the pipeline runs.
                  Older posts aren&apos;t re-checked, so their links may go nowhere.
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
                  We count page views with Vercel Web Analytics, which sets no cookies and stores no personal
                  identifiers. There are no ad trackers. Jobs you mark as applied are saved in your browser. If you create an
                  account (optional: sign in with Google, or an email and password), they&apos;re saved to it instead, so they survive
                  cleared browser data and show up on any device. You can delete your account at any time. The{" "}
                  <Link href="/privacy" className="link font-bold">
                    privacy policy
                  </Link>{" "}
                  has the details.
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

        <section id="ai-assistants" className="mt-28 scroll-mt-10 md:mt-40" aria-labelledby="assistants-title">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
            <h2 id="assistants-title" className="head lowercase lg:col-span-4">
              use it in claude or chatgpt
            </h2>
            <div className="lg:col-span-8">
              <p className="max-w-[60ch] text-lead">
                Connect your AI assistant to {SITE_NAME}&apos;s MCP server and ask for jobs in plain words: &ldquo;remote
                Python contracts paying $40/hr or more&rdquo;, or &ldquo;is this Reddit post a scam?&rdquo; with a link.
                It searches the same jobs, with the same scam warnings, and links back here and to the Reddit post.
              </p>
              <p className="mt-6 break-words font-mono font-bold">{MCP_URL}</p>
              <div className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
                <div>
                  <h3 className="text-lead font-bold">Claude</h3>
                  <p className="mt-2">
                    In Settings, open Connectors, choose Add custom connector and paste the address. Leave the OAuth fields
                    empty: there&apos;s nothing to sign in to. Works on every plan, including Free.
                  </p>
                </div>
                <div>
                  <h3 className="text-lead font-bold">ChatGPT</h3>
                  <p className="mt-2">
                    Custom connectors need a paid plan. Turn on developer mode in the connector settings, create a connector
                    with the address and no authentication, then switch it on in a chat from the + menu.
                  </p>
                </div>
                <div>
                  <h3 className="text-lead font-bold">Claude Code</h3>
                  <p className="mt-2 break-words font-mono text-small">claude mcp add --transport http only-hiring {MCP_URL}</p>
                </div>
                <div>
                  <h3 className="text-lead font-bold">Anything else</h3>
                  <p className="mt-2">
                    Cursor, VS Code and other clients that speak Streamable HTTP take the address as is. No key or account
                    needed. Applying still happens on Reddit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="who-makes-this" className="mt-28 scroll-mt-10 md:mt-40" aria-labelledby="maker-title">
          <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
            <h2 id="maker-title" className="head lowercase lg:col-span-4">
              who makes this
            </h2>
            <div className="max-w-[60ch] space-y-5 lg:col-span-8">
              <p className="text-lead">
                I&apos;m{" "}
                <a className="link font-bold" href={MAKER.url} target="_blank" rel="noopener noreferrer">
                  {MAKER.name}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                , a developer. I built {SITE_NAME} because looking for work on Reddit&apos;s job subreddits is a pain.
              </p>
              <p>
                The feeds are full of scam jobs and posts that go nowhere, and often half of what&apos;s there is people
                advertising their own services. When you&apos;re the one looking for a job, none of that matters. I only
                wanted to see the posts from people who were hiring.
              </p>
              <p>
                It started as a command-line tool I used to find and apply to jobs automatically. People I shared it with
                liked it a lot, so I turned it into this site so anyone can use it.
              </p>
              {removalEmail() && (
                <p>
                  Questions, ideas or problems? Email{" "}
                  <a className="link font-bold" href={`mailto:${removalEmail()}`}>
                    {removalEmail()}
                  </a>
                  , or use Feedback at the top of any page.
                </p>
              )}
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
