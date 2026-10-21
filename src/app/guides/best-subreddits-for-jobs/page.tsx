import type { Metadata } from "next";
import Link from "next/link";
import { ProseSection as Section } from "@/components/ProseSection";
import { SiteHeader } from "@/components/SiteHeader";
import { DataError } from "@/components/DataError";
import { getJobs, getSubredditStats } from "@/lib/db";
import { countLabel } from "@/lib/format";
import { hasScamWarning, isExpired, isLikelyScam } from "@/lib/jobs";
import { guideGraph, JsonLd } from "@/lib/jsonld";
import { SCAM_GUIDE_PATH } from "@/lib/scam-report";
import { EXPIRY_DAYS, MAKER, SITE_NAME } from "@/lib/site";
import {
  BEST_SUBS_PATH,
  COLLECTED_SINCE,
  MIN_PAY_SAMPLE,
  statsFor,
  subredditPath,
  SUBREDDITS,
  sumStats,
  typicalPay,
  type SubredditStats,
} from "@/lib/subreddits";

/** When the guide was first published. Its figures change with every sync. */
const PUBLISHED = "2026-10-21";

const headline = "The best subreddits for jobs, ranked by real hiring posts";

const describe = (graded: number | null) =>
  `Which of Reddit's job subreddits are actually hiring, what they pay, and which are mostly noise.${graded ? ` From ${graded} posts we read across ${SUBREDDITS.length} subreddits.` : ""}`;

/** The profiled subreddits that have stats, each with its stats. */
function withStats(all: SubredditStats[]) {
  return SUBREDDITS.flatMap((profile) => {
    const stats = statsFor(all, profile.name);
    return stats && stats.graded > 0 ? [{ ...profile, stats }] : [];
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const result = await getSubredditStats();
  const subs = result.ok ? withStats(result.subs) : [];
  const description = describe(subs.length > 0 ? sumStats(subs.map((s) => s.stats)).graded : null);
  return {
    title: { absolute: "Best subreddits for jobs, ranked by real hiring posts" },
    description,
    alternates: { canonical: BEST_SUBS_PATH },
    // A page-level openGraph replaces the inherited one, so the shared fields are listed again.
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: headline,
      description,
      url: BEST_SUBS_PATH,
      locale: "en_GB",
      publishedTime: PUBLISHED,
      modifiedTime: (result.ok && result.changedAt) || PUBLISHED,
      images: ["/opengraph-image"],
    },
    twitter: { card: "summary_large_image", title: headline, description, images: ["/opengraph-image"] },
  };
}

const pct = (part: number, whole: number) => `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Where to start, by the kind of work. Subreddit names must have a profile in lib/subreddits. */
const PICKS = [
  {
    need: "Freelance work of any kind",
    subs: ["forhire", "hiring"],
    why: "The two big general boards. Titles are tagged, so the hiring posts are easy to find, and most of them state a rate.",
  },
  {
    need: "Quick paid tasks",
    subs: ["slavelabour", "DoneDirtCheap"],
    why: "Jobs that take an hour or two. The pay is low, but nearly every post is a real task.",
  },
  {
    need: "Art and illustration",
    subs: ["HungryArtists", "gameDevClassifieds"],
    why: "Commissions with the budget in the post on r/HungryArtists, and art for indie games on r/gameDevClassifieds.",
  },
  {
    need: "Graphic and UI design",
    subs: ["DesignJobs"],
    why: "Logos, app UI and web design, usually with the budget in the title.",
  },
  {
    need: "Writing",
    subs: ["HireaWriter"],
    why: "Mostly YouTube scripts. It's small, and some posts want a large unpaid writing test.",
  },
  {
    need: "Software development",
    subs: ["devjobs", "remotejs", "remotepython"],
    why: "Smaller boards where far more of the posts are hiring. r/developerjobs and r/softwareengineerjobs are bigger, but most of their posts aren't jobs.",
  },
  {
    need: "Salaried tech jobs",
    subs: ["jobbit", "RemoteJobs"],
    why: "Full-time roles at named companies, where you apply on the company's own site. Both are slow.",
  },
  {
    need: "AI and machine learning",
    subs: ["MachineLearningJobs", "remotepython"],
    why: "Contracts training and evaluating AI models at high hourly rates, and some salaried ML roles.",
  },
  {
    need: "Jobs in Pakistan",
    subs: ["hiringpakistan"],
    why: "One of the busiest subreddits we read, with on-site jobs in the big cities and remote work.",
  },
];

/** Subreddits where fewer than this share of the posts we read were hiring. */
const NOISY_SHARE = 0.25;

/** "a, b and c". */
const listNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

function SubLink({ name }: { name: string }) {
  return (
    <Link href={subredditPath(name)} className="link font-bold">
      r/{name}
    </Link>
  );
}

/** Open jobs per subreddit right now, from the jobs table. */
async function openCounts() {
  const result = await getJobs();
  if (!result.ok) return null;
  const now = Date.parse(result.fetchedAt);
  const counts = new Map<string, number>();
  let open = 0;
  let warned = 0;
  let hidden = 0;
  for (const job of result.jobs) {
    if (isExpired(job, now)) continue;
    if (isLikelyScam(job)) {
      hidden++;
      continue;
    }
    open++;
    if (hasScamWarning(job)) warned++;
    const key = job.subreddit.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { counts, open, warned, hidden };
}

export default async function BestSubredditsPage() {
  const [live, stats] = await Promise.all([openCounts(), getSubredditStats()]);
  const subs = stats.ok ? withStats(stats.subs) : [];
  if (subs.length === 0) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="shell pt-10 pb-28 md:pt-16 md:pb-40">
          <h1 className="display">best subreddits for jobs</h1>
          <DataError />
        </main>
      </>
    );
  }
  const updated = (stats.ok && stats.changedAt) || PUBLISHED;
  const description = describe(sumStats(subs.map((s) => s.stats)).graded);
  const ranked = [...subs].sort((a, b) => b.stats.hiring - a.stats.hiring || a.name.localeCompare(b.name));
  const noisy = subs.filter((s) => s.stats.hiring / s.stats.graded < NOISY_SHARE).sort(
    (a, b) => a.stats.hiring / a.stats.graded - b.stats.hiring / b.stats.graded,
  );
  // Fixed prices first, then hourly rates, each by sample size.
  const paid = subs.flatMap((s) => {
    const pay = typicalPay(s.stats);
    return pay ? [{ s, pay }] : [];
  }).sort((a, b) => Number(a.pay.hourly) - Number(b.pay.hourly) || b.pay.n - a.pay.n);
  const all = sumStats(subs.map((s) => s.stats));
  const cleanest = ranked.filter((s) => s.stats.graded >= 20 && s.stats.hiring / s.stats.graded >= 0.9);

  const tiles = [
    { value: subs.length, label: "job subreddits" },
    { value: all.graded, label: "posts we read" },
    { value: all.hiring, label: "were hiring" },
    ...(live ? [{ value: live.open, label: "open jobs right now" }] : []),
  ];

  return (
    <>
      <SiteHeader />
      <main id="main" className="shell pt-10 pb-28 md:pt-16 md:pb-40">
        <article>
          <h1 className="display">best subreddits for jobs</h1>
          <p className="mt-8 max-w-[46ch] text-lead md:mt-10">
            We read {all.graded} posts from {subs.length} of Reddit&apos;s job subreddits to see which ones are
            actually hiring. Here&apos;s where to look, depending on the work you do.
          </p>
          <p className="mt-4 text-body text-muted">
            By{" "}
            <a className="link" href={MAKER.url} target="_blank" rel="noopener noreferrer">
              {MAKER.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            . Figures from every post collected since {COLLECTED_SINCE}, updated {dateLabel(updated)}.
          </p>

          <ul className="mt-14 grid grid-cols-2 gap-3 md:mt-20 lg:grid-cols-4">
            {tiles.map((tile) => (
              <li key={tile.label} className="bg-surface px-5 py-6">
                <span className="block text-[clamp(2.5rem,6vw,4rem)] leading-none font-bold tabular-nums">
                  {tile.value}
                </span>
                <span className="mt-3 block">{tile.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-20 space-y-14 md:mt-28">
            <Section id="short" title="The short version">
              <p>
                Most job subreddits are crowded with people offering their own services, so the best ones are those where
                the hiring posts are easy to find and state the pay. By the kind of work:
              </p>
              <ul className="space-y-6">
                {PICKS.map((pick) => (
                  <li key={pick.need}>
                    <h3 className="font-bold">{pick.need}</h3>
                    <p className="mt-1">
                      {pick.subs.map((name, i) => (
                        <span key={name}>
                          {i > 0 && (i === pick.subs.length - 1 ? " and " : ", ")}
                          <SubLink name={name} />
                        </span>
                      ))}
                      . {pick.why}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="ranked" title="Every subreddit, ranked">
              <p>
                Ranked by how many hiring posts we found, with the share of posts that were hiring and the median pay
                where enough posts stated it.
                {live && ` The last column is live: jobs posted in the last ${EXPIRY_DAYS} days that are listed now.`}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left tabular-nums">
                  <caption className="sr-only">Hiring posts, share hiring, median pay and open jobs per subreddit</caption>
                  <thead>
                    <tr className="border-b-2 border-surface-2">
                      <th scope="col" className="py-2 pr-4 font-bold">
                        Subreddit
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right font-bold">
                        Hiring posts
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right font-bold">
                        Share hiring
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right font-bold">
                        Median pay
                      </th>
                      {live && (
                        <th scope="col" className="py-2 text-right font-bold">
                          Open now
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((s) => {
                      const pay = typicalPay(s.stats);
                      return (
                        <tr key={s.slug} className="border-b border-surface-2">
                          <th scope="row" className="py-2 pr-4 font-normal">
                            <SubLink name={s.name} />
                          </th>
                          <td className="py-2 pr-4 text-right">{s.stats.hiring}</td>
                          <td className="py-2 pr-4 text-right">{pct(s.stats.hiring, s.stats.graded)}</td>
                          <td className="py-2 pr-4 text-right whitespace-nowrap">{pay ? pay.text : <span className="text-muted">–</span>}</td>
                          {live && <td className="py-2 text-right">{live.counts.get(s.slug) ?? 0}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p>
                The share counts only posts we read. Posts already tagged [For Hire] or [Offer] were skipped first, so on
                subreddits that tag strictly, like {listNames(cleanest.slice(0, 3).map((s) => `r/${s.name}`))}, nearly
                everything left was hiring.
              </p>
            </Section>

            <Section id="noise" title="Where most posts aren't jobs">
              <p>
                {noisy.length === 0
                  ? "Every subreddit we read was mostly hiring posts."
                  : `${countLabel(noisy.length, "subreddit")} with a job board's name turned out to be mostly something else.`}
              </p>
              <ul className="space-y-4">
                {noisy.map((s) => (
                  <li key={s.slug}>
                    <SubLink name={s.name} />: {s.stats.hiring} of {s.stats.graded} posts were hiring (
                    {pct(s.stats.hiring, s.stats.graded)}). The rest were mostly{" "}
                    {s.stats.discussion >= s.stats.forHire
                      ? "questions and career discussion"
                      : "people offering their services without tagging them"}
                    .
                  </li>
                ))}
              </ul>
              <p>
                They&apos;re still worth checking, since their hiring posts are often well-paid tech roles, but scrolling
                them yourself takes a while. That&apos;s the job {SITE_NAME} does: it reads every post and lists only the
                hiring ones.
              </p>
            </Section>

            <Section id="pay" title="What they pay">
              <p>
                Medians from hiring posts that stated a US-dollar amount, for subreddits with at least {MIN_PAY_SAMPLE}{" "}
                such posts. Fixed prices are per job, and the samples are small, so treat these as a rough guide.
              </p>
              <ul className="space-y-2">
                {paid.map(({ s, pay }) => (
                  <li key={s.slug} className="flex items-baseline justify-between gap-4 border-b border-surface-2 pb-2">
                    <SubLink name={s.name} />
                    <span className="text-right tabular-nums">
                      <span className="font-bold">{pay.text}</span>{" "}
                      <span className="text-small text-muted">from {pay.n} posts</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p>
                The gap is the point: art and design commissions on <SubLink name="HungryArtists" /> and <SubLink name="DesignJobs" /> run to hundreds of dollars, while a task on <SubLink name="slavelabour" />{" "}
                or <SubLink name="DoneDirtCheap" /> is usually tens. Most subreddits don&apos;t make the list at all, because
                too few of their posts state pay.
              </p>
            </Section>

            <Section id="scams" title="Scams">
              <p>
                Outright scams are rare on these subreddits. Low pay and unpaid tests are much more common.
                {live &&
                  ` Right now, ${live.warned} of the ${live.open} open jobs carry a scam warning, and ${live.hidden} more ${
                    live.hidden === 1 ? "is" : "are"
                  } hidden as likely scams.`}
              </p>
              <p>
                Our{" "}
                <Link href={SCAM_GUIDE_PATH} className="link font-bold">
                  guide to Reddit job scams
                </Link>{" "}
                breaks it down by subreddit, with the warning signs we see most.
              </p>
            </Section>

            <Section id="tips" title="Getting hired from a subreddit">
              <ul className="list-disc space-y-2 pl-5">
                <li>Sort by New and check often. The first good replies get read; later ones often don&apos;t.</li>
                <li>Read the subreddit&apos;s rules before you post or reply, and use its tags.</li>
                <li>Answer what the post asks: rates, a portfolio link, a code word. Generic replies get skipped.</li>
                <li>Agree on the work, the pay and how you&apos;ll be paid in writing, before you start.</li>
                <li>Never pay to get a job, and keep ID and bank details back until there&apos;s a real offer.</li>
              </ul>
            </Section>

            <Section id="method" title="How we got these numbers">
              <p>
                {SITE_NAME} collects new posts from the subreddits listed here, and skips the ones tagged [For Hire] or
                [Offer]. A language model reads each remaining post, decides whether it&apos;s hiring, and pulls out the
                role, pay and location. The figures above come from all {all.graded} posts collected since {COLLECTED_SINCE},
                with reposts and crossposts counted once, and they update as new posts come in.
              </p>
              <p>
                The model can be wrong, and some subreddits have only a handful of posts, so take the exact numbers loosely. The
                differences between subreddits are large enough to hold up.{" "}
                <Link href="/about" className="link font-bold">
                  How {SITE_NAME} works
                </Link>{" "}
                has more.
              </p>
            </Section>
          </div>
        </article>

        <div className="mt-24">
          <p className="max-w-[48ch] text-lead">
            The board lists the hiring posts from all {subs.length} subreddits in one place, newest first.
          </p>
          <Link href="/" className="btn mt-8">
            See all jobs
          </Link>
        </div>
      </main>
      <JsonLd data={guideGraph({ path: BEST_SUBS_PATH, headline, description, published: PUBLISHED, updated })} />
    </>
  );
}
