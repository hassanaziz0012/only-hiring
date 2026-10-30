import type { Metadata } from "next";
import Link from "next/link";
import { DataError } from "@/components/DataError";
import { ProseSection } from "@/components/ProseSection";
import { SiteHeader } from "@/components/SiteHeader";
import { StatsShare } from "@/components/StatsShare";
import { getSiteStats } from "@/lib/db";
import { SITE_NAME } from "@/lib/site";
import {
  num,
  pct,
  SCAM_BANDS,
  STATS_IMAGE_PATH,
  STATS_PATH,
  statsDate,
  statsMonth,
  type Bar,
  type SiteStats,
} from "@/lib/stats";
import { BEST_SUBS_PATH } from "@/lib/subreddits";
import { SCAM_GUIDE_PATH } from "@/lib/scam-report";

const headline = "Reddit job posts, by the numbers";

const warnedOf = (s: SiteStats) => s.scam.warned + s.scam.likely;

const describe = (s: SiteStats | null) =>
  s && s.read > 0
    ? `What ${num(s.read)} posts from ${s.subreddits} of Reddit's job subreddits turned out to be: ${pct(s.hiring, s.read)} were hiring, and ${pct(warnedOf(s), s.hiring)} of those got a scam warning. Plus the roles, pay, countries and languages the jobs ask for.`
    : "What the posts on Reddit's job subreddits turn out to be, and what the jobs ask for.";

export async function generateMetadata(): Promise<Metadata> {
  const description = describe(await getSiteStats());
  return {
    title: "Reddit job post statistics",
    description,
    alternates: { canonical: STATS_PATH },
    // A page-level openGraph replaces the inherited one, so the shared fields are listed again.
    openGraph: { type: "website", siteName: SITE_NAME, title: headline, description, url: STATS_PATH, locale: "en_GB" },
    twitter: { card: "summary_large_image", title: headline, description },
  };
}

/** A ranked list of bars, each scaled to the longest, with the count and its share of `base`. */
function Bars({ bars, base, flagged = false }: { bars: Bar[]; base: number; flagged?: boolean }) {
  const max = Math.max(1, ...bars.map((b) => b.n));
  return (
    <ul className="space-y-3">
      {bars.map((bar) => (
        <li key={bar.label}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="min-w-0">{bar.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-bold">{num(bar.n)}</span>
              <span className="ml-2 inline-block min-w-[3.25ch] text-right text-muted">{pct(bar.n, base)}</span>
            </span>
          </div>
          <div aria-hidden="true" className="mt-1.5 h-2.5">
            <div
              className={`h-full ${bar.muted ? "bg-scale-doubts" : flagged ? "bg-pink-deep" : "bg-accent"}`}
              style={{ width: `${(bar.n / max) * 100}%`, minWidth: bar.n > 0 ? 3 : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Panel({ id, title, note, children }: { id: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0 border-t-2 border-surface-2 pt-8">
      <h3 id={id} className="text-lead font-bold tracking-tight">
        {title}
      </h3>
      <p className="mt-1 text-muted">{note}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** The four scam-score bands as one bar, good to bad, with a legend that carries every value. */
function ScamScale({ stats }: { stats: SiteStats }) {
  const bands = SCAM_BANDS.map((b) => ({ ...b, n: stats.scam[b.key] }));
  return (
    <div>
      <div aria-hidden="true" className="flex h-6 gap-[2px]">
        {bands
          .filter((b) => b.n > 0)
          .map((b) => (
            <div key={b.key} style={{ flexGrow: b.n, flexBasis: 0, minWidth: 3, background: `var(--${b.color})` }} />
          ))}
      </div>
      <ul className="mt-6 space-y-3">
        {bands.map((b) => (
          <li key={b.key} className="flex items-baseline justify-between gap-4">
            <span className="flex min-w-0 items-baseline gap-3">
              <span aria-hidden="true" className="size-3.5 shrink-0 self-center" style={{ background: `var(--${b.color})` }} />
              <span>
                {b.label} <span className="text-muted">({b.range})</span>
              </span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-bold">{num(b.n)}</span>
              <span className="ml-2 inline-block min-w-[3.25ch] text-right text-muted">{pct(b.n, stats.hiring)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A big share with what it's a share of, for panels led by one figure. */
function Lead({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <p className="mb-6 flex items-baseline gap-3">
      <span className="text-[clamp(2.25rem,4vw,3rem)] leading-none font-bold">{value}</span>
      <span>{children}</span>
    </p>
  );
}

export default async function StatsPage() {
  const stats = await getSiteStats();
  if (!stats || stats.read === 0) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="shell pt-10 pb-28 md:pt-16 md:pb-40">
          <h1 className="display">by the numbers</h1>
          <DataError />
        </main>
      </>
    );
  }

  const fileName = stats.updatedAt ? `onlyhiring-stats-${stats.updatedAt.slice(0, 10)}` : "onlyhiring-stats";
  const tiles = [
    { value: num(stats.read), label: "posts read" },
    { value: num(stats.hiring), label: `were hiring (${pct(stats.hiring, stats.read)})` },
    { value: num(stats.listed), label: "jobs on the site" },
    { value: num(warnedOf(stats)), label: `got a scam warning (${pct(warnedOf(stats), stats.hiring)} of hiring posts)` },
  ];
  const ofListed = `Of the ${num(stats.listed)} jobs on the site`;

  return (
    <>
      <SiteHeader />
      <main id="main" className="shell pt-10 pb-28 md:pt-16 md:pb-40">
        <h1 className="display">by the numbers</h1>
        <p className="mt-8 max-w-[46ch] text-lead md:mt-10">
          Every post {SITE_NAME} has read from {stats.subreddits} of Reddit&apos;s job subreddits
          {stats.collectingSince && ` since ${statsMonth(stats.collectingSince)}`}, what they turned out to be, and what
          the jobs ask for.
        </p>
        {stats.updatedAt && (
          <p className="mt-4 text-muted">
            Updated {statsDate(stats.updatedAt)}. The figures change as new posts come in.
          </p>
        )}

        <StatsShare src={STATS_IMAGE_PATH} fileName={fileName} />

        <ul className="mt-14 grid grid-cols-2 gap-3 md:mt-20 lg:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.label} className="bg-surface px-5 py-6">
              <span className="block text-[clamp(2.5rem,6vw,4rem)] leading-none font-bold">{tile.value}</span>
              <span className="mt-3 block">{tile.label}</span>
            </li>
          ))}
        </ul>

        <section aria-labelledby="posts" className="mt-24 md:mt-32">
          <h2 id="posts" className="head lowercase">
            every post we read
          </h2>
          <div className="mt-10 grid gap-x-16 gap-y-14 lg:grid-cols-2">
            <Panel id="post-types" title="What the posts were" note={`Of ${num(stats.read)} posts, reposts counted once`}>
              <Bars bars={stats.postTypes} base={stats.read} />
            </Panel>
            <Panel id="scam-scores" title="How the hiring posts scored" note={`Scam scores of ${num(stats.hiring)} hiring posts`}>
              <ScamScale stats={stats} />
              {stats.removedByReddit > 0 && (
                <p className="mt-6 text-muted">
                  Reddit itself later removed {num(stats.removedByReddit)} of them ({pct(stats.removedByReddit, stats.hiring)}).
                </p>
              )}
            </Panel>
            <Panel id="red-flags" title="Red flags" note={`Hiring posts with each kind of red flag, of ${num(stats.hiring)}`}>
              <Bars bars={stats.flags} base={stats.hiring} flagged />
            </Panel>
            <Panel id="subreddits" title="Where the hiring posts were" note={`Hiring posts by subreddit, of ${num(stats.hiring)}`}>
              <Bars bars={stats.bySubreddit} base={stats.hiring} />
            </Panel>
          </div>
        </section>

        <section aria-labelledby="jobs" className="mt-24 md:mt-32">
          <h2 id="jobs" className="head lowercase">
            the jobs on the site
          </h2>
          <div className="mt-10 grid gap-x-16 gap-y-14 lg:grid-cols-2">
            <Panel id="roles" title="Roles" note={ofListed}>
              <Bars bars={stats.roles} base={stats.listed} />
            </Panel>
            <Panel id="work-mode" title="Remote or on-site" note={ofListed}>
              <Bars bars={stats.workModes} base={stats.listed} />
            </Panel>
            {stats.regions.length > 0 && (
              <Panel
                id="regions"
                title="Countries remote jobs are open to"
                note={`Of the ${num(stats.restrictedRemote)} remote jobs open to certain countries only`}
              >
                <Bars bars={stats.regions} base={stats.restrictedRemote} />
              </Panel>
            )}
            <Panel id="languages" title="Languages" note={ofListed}>
              <Lead value={pct(stats.withLanguage, stats.listed)}>name a language you need</Lead>
              <Bars bars={stats.languages} base={stats.listed} />
            </Panel>
            <Panel id="employment" title="Type of work" note={ofListed}>
              <Bars bars={stats.employment} base={stats.listed} />
            </Panel>
            <Panel id="seniority" title="Experience level" note={ofListed}>
              <Bars bars={stats.seniority} base={stats.listed} />
            </Panel>
            <Panel id="pay" title="Pay" note={ofListed}>
              <Lead value={pct(stats.withPay, stats.listed)}>state a pay amount</Lead>
              {stats.medianPay.length > 0 && (
                <>
                  <p className="text-muted">Median pay in US dollars, by how it&apos;s paid:</p>
                  <ul className="mt-3 space-y-2">
                    {stats.medianPay.map((m) => (
                      <li key={m.label} className="flex items-baseline justify-between gap-4 border-b border-surface-2 pb-2">
                        <span>{m.label}</span>
                        <span className="shrink-0 text-right tabular-nums">
                          <span className="font-bold">{m.text}</span>{" "}
                          <span className="text-muted">from {num(m.n)} jobs</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
            <Panel id="tests" title="Test tasks" note={ofListed}>
              <Lead value={pct(stats.withTest, stats.listed)}>ask for a test task before hiring</Lead>
              {stats.withTest > 0 && <Bars bars={stats.tests} base={stats.withTest} />}
            </Panel>
          </div>

          {stats.skills.length > 0 && (
            <div className="mt-14">
              <Panel id="skills" title="Skills asked for most" note={`Jobs naming each skill, of ${num(stats.listed)}`}>
                <ul className="flex flex-wrap gap-2">
                  {stats.skills.map((s) => (
                    <li key={s.label} className="bg-mint px-3 py-1.5 text-mint-ink">
                      {s.label} <span className="ml-1 font-bold tabular-nums">{num(s.n)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}
        </section>

        <div className="mt-24 md:mt-32">
          <ProseSection id="method" title="How these are counted">
            <p>
              {SITE_NAME} collects new posts from Reddit&apos;s job subreddits and skips the ones already tagged [For Hire]
              or [Offer]. A language model reads each remaining post, decides what it is, scores how likely it is to be a
              scam, and pulls out the role, pay, location and requirements. Posts that are clearly not hiring, judged
              from their flair or by a simple classifier trained on the model&apos;s earlier decisions, are set aside
              without being graded.
            </p>
            <p>
              The first section counts every post it has read, with reposts and crossposts counted once. The second counts
              the jobs on the site now: a post deleted from Reddit comes off the site too, so there are fewer of these than
              hiring posts. Grey bars are the posts that weren&apos;t hiring, and jobs that didn&apos;t say.
            </p>
            <p>
              The model can be wrong, so take exact numbers loosely. Read{" "}
              <Link href="/about" className="link font-bold">
                how {SITE_NAME} works
              </Link>
              , the{" "}
              <Link href={BEST_SUBS_PATH} className="link font-bold">
                subreddits ranked
              </Link>{" "}
              or the{" "}
              <Link href={SCAM_GUIDE_PATH} className="link font-bold">
                guide to Reddit job scams
              </Link>{" "}
              for more.
            </p>
          </ProseSection>
        </div>

        <div className="mt-24">
          <p className="max-w-[48ch] text-lead">Every hiring post, in one list, newest first.</p>
          <Link href="/" className="btn mt-8">
            See all jobs
          </Link>
        </div>
      </main>
    </>
  );
}
