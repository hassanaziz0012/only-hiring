import type { Metadata } from "next";
import Link from "next/link";
import { ProseSection as Section } from "@/components/ProseSection";
import { SiteHeader } from "@/components/SiteHeader";
import { DataError } from "@/components/DataError";
import { getJobs, getSubredditStats } from "@/lib/db";
import { hasScamWarning, isExpired, isLikelyScam } from "@/lib/jobs";
import { guideGraph, JsonLd } from "@/lib/jsonld";
import { SCAM_GUIDE_PATH, SCAM_GUIDE_PUBLISHED, scamReport } from "@/lib/scam-report";
import { EXPIRY_DAYS, MAKER, SCAM_HIDE_THRESHOLD, SCAM_WARN_THRESHOLD, SITE_NAME } from "@/lib/site";
import { COLLECTED_SINCE, statsFor, type FlagKind } from "@/lib/subreddits";

function texts(hiring: number | null) {
  const from = hiring ? ` in ${hiring} hiring posts` : "";
  return {
    headline: `Reddit job scams: what we found${from}`,
    description: `How often scams turn up on Reddit's job subreddits, the warning signs we saw most, and what to check before you reply.${hiring ? ` From ${hiring} hiring posts we graded.` : ""}`,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getSubredditStats();
  const report = stats.ok ? scamReport(stats.subs) : null;
  const { headline, description } = texts(report?.totals.hiring || null);
  const modified = (stats.ok && stats.changedAt) || SCAM_GUIDE_PUBLISHED;
  return {
    title: { absolute: headline },
    description,
    alternates: { canonical: SCAM_GUIDE_PATH },
    // A page-level openGraph replaces the inherited one, so the shared fields are listed again.
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: headline,
      description,
      url: SCAM_GUIDE_PATH,
      locale: "en_GB",
      publishedTime: SCAM_GUIDE_PUBLISHED,
      modifiedTime: modified,
      images: ["/opengraph-image"],
    },
    twitter: { card: "summary_large_image", title: headline, description, images: ["/opengraph-image"] },
  };
}

const pct = (part: number, whole: number) => `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const FLAG_NOTES: Record<FlagKind, string> = {
  vague:
    "No task, no deliverables, sometimes no role at all. Often it's just a lazy post, but it's also how scams open: the details only arrive in a DM.",
  lowPay:
    "$2 an hour for social media work across several platforms, $4 an hour for a whole shift on a live video call, $200 to illustrate an entire graphic novel.",
  freeWork:
    "A 4,000-word writing sample in the application form, a 48-hour build challenge where only the top three teams get paid, a character design contest that hands the winners' rights to the studio.",
  highPay:
    "Big money for trivial tasks, like half of every payment you “handle”. When pay looks too good for the effort, find out why before you reply.",
  money:
    "Receiving payments and passing them on, or promoting a forex trading group. These are the posts that can get you into legal trouble, not just cost you time.",
};

const SCAMS = [
  {
    title: "Moving money or parcels",
    body: "You receive payments or packages and pass them on, keeping a cut. One post we graded offered “50% of each deposit you receive” with no experience needed. Moving money for strangers can make you part of money laundering, and you're the one the bank can trace.",
  },
  {
    title: "Paying to start",
    body: "Paid training, a starter kit, equipment you buy and get “reimbursed” for, or a cheque that overpays you and asks for the difference back. Real employers don't charge you to work for them.",
  },
  {
    title: "Renting out your account",
    body: "A weekly fee to “borrow” your LinkedIn, Upwork, Reddit or bank account. The renter works or moves money under your name, and the bans and debts land on you.",
  },
  {
    title: "Telegram or WhatsApp only",
    body: "Moving to a chat app is common and usually fine. A post with no details and only a Telegram or WhatsApp contact is different. It's how task scams start: small payments for likes or reviews, then a deposit to unlock bigger tasks.",
  },
  {
    title: "Your ID or bank details up front",
    body: "Nobody needs a passport scan or card details before they've hired you. Share tax and bank details only after there's a signed contract, through real payroll or a payment platform.",
  },
  {
    title: "Recruiting and “investment” roles",
    body: "Jobs that pay you for signing up other people, or for promoting crypto and forex trading. The money comes from your recruits or your own deposits, not from work.",
  },
];

/** Today's figures from the board, so the guide's dated snapshot has a live companion. */
async function LiveCount() {
  const result = await getJobs();
  if (!result.ok) return null;
  const now = Date.parse(result.fetchedAt);
  const open = result.jobs.filter((job) => !isExpired(job, now));
  if (open.length === 0) return null;
  const warned = open.filter(hasScamWarning).length;
  const hidden = open.filter(isLikelyScam).length;
  return (
    <p className="text-muted">
      Right now, {warned} of the {open.length} jobs posted on the board in the last {EXPIRY_DAYS} days carry a warning,
      and {hidden} {hidden === 1 ? "is" : "are"} hidden as likely scams.
    </p>
  );
}

export default async function ScamGuidePage() {
  const stats = await getSubredditStats();
  if (!stats.ok || stats.subs.length === 0) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="shell pt-10 pb-28 md:pt-16 md:pb-40">
          <h1 className="display">reddit job scams</h1>
          <DataError />
        </main>
      </>
    );
  }

  const report = scamReport(stats.subs);
  const s = report.totals;
  const { headline, description } = texts(s.hiring);
  const updated = stats.changedAt ?? SCAM_GUIDE_PUBLISHED;
  const forhire = statsFor(stats.subs, "forhire");
  const slavelabour = statsFor(stats.subs, "slavelabour");
  const ddc = statsFor(stats.subs, "DoneDirtCheap");
  const tiles = [
    { value: s.graded, label: "posts graded" },
    { value: s.hiring, label: "were hiring" },
    { value: s.warned, label: "carried a scam warning" },
    { value: s.likely, label: "scored as likely scams" },
  ];

  return (
    <>
      <SiteHeader />
      <main id="main" className="shell pt-10 pb-28 md:pt-16 md:pb-40">
        <article>
          <h1 className="display">reddit job scams</h1>
          <p className="mt-8 max-w-[44ch] text-lead md:mt-10">
            What scams look like on Reddit&apos;s job subreddits, and how often they turn up, from {s.hiring} hiring
            posts we graded.
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
                Outright scams were rare. Of {s.hiring} hiring posts, {s.likely} ({pct(s.likely, s.hiring)}) scored as
                likely scams, and {s.warned} ({pct(s.warned, s.hiring)}) carried a warning of any kind.{" "}
                {s.clean * 2 > s.hiring ? "Most" : "Many"}, {s.clean} of {s.hiring}, showed no warning signs at all.
              </p>
              <p>
                The more common problem is exploitation: real posts that ask for free work, pay far below what the work
                is worth, or say so little that you can&apos;t tell what the job is.
              </p>
              <LiveCount />
            </Section>

            <Section id="signs" title="The warning signs we saw most">
              <p>
                {s.anyFlag} of the {s.hiring} hiring posts had at least one warning sign. Grouped by kind, with the
                number of posts showing each:
              </p>
              <ul className="space-y-6">
                {report.flagKinds.map((flag) => (
                  <li key={flag.kind} className="grid grid-cols-[3.5rem_1fr] gap-x-4">
                    <span className="row-span-2 text-lead leading-tight font-bold tabular-nums">
                      {flag.posts}
                      <span className="sr-only"> posts:</span>
                    </span>
                    <h3 className="font-bold">{flag.label}</h3>
                    <p className="mt-1">{FLAG_NOTES[flag.kind]}</p>
                  </li>
                ))}
              </ul>
              <p>
                A short paid test is fair. An unpaid one that produces something the poster can use is free work. Ask
                for a smaller test, or for it to be paid.
              </p>
            </Section>

            <Section id="scams" title="Scams to know before you reply">
              <p>
                These were rare in our data, but they&apos;re the ones that cost people money, accounts or worse. Each
                one is a reason to stop replying.
              </p>
              <ul className="space-y-6">
                {SCAMS.map((scam) => (
                  <li key={scam.title}>
                    <h3 className="font-bold">{scam.title}</h3>
                    <p className="mt-1">{scam.body}</p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="normal" title="What isn't a red flag on Reddit">
              <p>
                Some things look odd if you&apos;re used to job boards but are how hiring on Reddit normally works. Our
                grader is told not to count them as warning signs on their own:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Applying by DM or in the comments.</li>
                <li>A client who doesn&apos;t name a company. Many are individuals.</li>
                <li>No pay in the post.</li>
                <li>Being paid in crypto. Being asked to buy or deposit crypto is a different matter.</li>
                <li>Requirements about location, age, language or equipment.</li>
              </ul>
            </Section>

            <Section id="subreddits" title="Subreddit by subreddit">
              <p>
                Hiring posts and warnings per subreddit. The numbers are small, so one busy poster can move a
                subreddit&apos;s share a lot.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left tabular-nums">
                  <caption className="sr-only">Hiring posts, warnings and likely scams per subreddit</caption>
                  <thead>
                    <tr className="border-b-2 border-surface-2">
                      <th scope="col" className="py-2 pr-4 font-bold">
                        Subreddit
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right font-bold">
                        Hiring posts
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right font-bold">
                        With a warning
                      </th>
                      <th scope="col" className="py-2 text-right font-bold">
                        Likely scams
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.subreddits.map((row) => (
                      <tr key={row.subreddit} className="border-b border-surface-2">
                        <th scope="row" className="py-2 pr-4 font-normal">
                          r/{row.subreddit}
                        </th>
                        <td className="py-2 pr-4 text-right">{row.hiring}</td>
                        <td className="py-2 pr-4 text-right">{row.warned}</td>
                        <td className="py-2 text-right">{row.likely}</td>
                      </tr>
                    ))}
                    <tr>
                      <th scope="row" className="py-2 pr-4 font-normal text-muted">
                        {report.others.count} others
                      </th>
                      <td className="py-2 pr-4 text-right">{report.others.hiring}</td>
                      <td className="py-2 pr-4 text-right">{report.others.warned}</td>
                      <td className="py-2 text-right">{report.others.likely}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {forhire && (
                <>
                  <h3 className="pt-4 font-bold">Is r/forhire safe?</h3>
                  <p>
                    Of {forhire.hiring} hiring posts on r/forhire, {forhire.warned} carried a warning and{" "}
                    {forhire.likely === 0 ? "none" : forhire.likely} scored as likely scams. Most of the subreddit is
                    people offering their own services; we skip those posts before grading.
                  </p>
                </>
              )}
              {slavelabour && (
                <>
                  <h3 className="pt-4 font-bold">Is r/slavelabour legit?</h3>
                  <p>
                    Of {slavelabour.hiring} hiring posts, {slavelabour.warned} carried a warning and{" "}
                    {slavelabour.likely === 0 ? "none" : slavelabour.likely} scored as likely scams. It&apos;s a
                    subreddit for small, cheap tasks, so expect low pay rather than fraud.
                  </p>
                </>
              )}
              {ddc && (
                <p>
                  The same goes for r/DoneDirtCheap, where the risk is the pay: {ddc.flags.lowPay} of its {ddc.hiring}{" "}
                  hiring posts were flagged for pay far below the work, which is what the name promises, and{" "}
                  {ddc.warned} scored high enough for a scam warning.
                </p>
              )}
            </Section>

            <Section id="checklist" title="Before you reply">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Read the whole post on Reddit, and the comments. Other users often call out scams there.</li>
                <li>Look at the poster&apos;s profile: how old the account is, and whether people have warned about them before.</li>
                <li>Search for the company name and for a distinctive sentence from the post.</li>
                <li>Get the task, the pay and how you&apos;ll be paid in writing before you start.</li>
                <li>Never pay, buy equipment, or send ID or bank details to get a job.</li>
                <li>For larger pieces of work, ask for part of the payment up front, or agree paid milestones.</li>
              </ol>
            </Section>

            <Section id="caught" title="If it's already happened">
              <ul className="list-disc space-y-2 pl-5">
                <li>Stop replying, and don&apos;t send more money, files or details.</li>
                <li>If you sent money or bank details, call your bank now.</li>
                <li>If you shared an account login, change the password and sign out every other session.</li>
                <li>Report the post to the subreddit&apos;s moderators and to Reddit.</li>
                <li>
                  Report it to your country&apos;s fraud reporting service. In the US that&apos;s the FTC, at{" "}
                  <a className="link font-bold" href="https://reportfraud.ftc.gov/" target="_blank" rel="noopener noreferrer">
                    ReportFraud.ftc.gov
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  .
                </li>
              </ul>
              <p>If you found the scam through {SITE_NAME}, tell me with Feedback at the top of the page.</p>
            </Section>

            <Section id="method" title="How we got these numbers">
              <p>
                The figures come from {s.graded} posts collected from {report.subredditCount} job subreddits since{" "}
                {COLLECTED_SINCE}, and update as new posts come in. Posts tagged
                [For Hire] or [Offer] were skipped before grading. A language model read each post, decided whether it
                was hiring, scored it from 0 to 1 for scam risk using a fixed guide, and listed the warning signs it saw.
                Reposts and crossposts count once.
              </p>
              <p>
                Of the {s.graded} posts, {s.hiring} were hiring, {s.discussion} were discussion or questions,{" "}
                {s.forHire} were people offering their services, {s.spam} were spam or promotion, {s.unpaid} offered no
                pay at all, and {s.other} were something else. A score of {SCAM_WARN_THRESHOLD} or more earns a warning,
                and {SCAM_HIDE_THRESHOLD} or more marks a likely scam. The warning signs are grouped by the words the
                model used.
              </p>
              <p>
                The scores are one model&apos;s judgement, and it gets some wrong in both directions. Treat a warning as
                a reason to look closer, not a verdict. One outside check: Reddit itself later removed{" "}
                {s.removedWarned} of the {s.warned} posts with a warning ({pct(s.removedWarned, s.warned)}), against{" "}
                {s.removedUnwarned} of the {s.hiring - s.warned} without one ({pct(s.removedUnwarned, s.hiring - s.warned)}).
              </p>
              <p>
                <Link href="/about" className="link font-bold">
                  How {SITE_NAME} works
                </Link>{" "}
                has more on the grading.
              </p>
            </Section>
          </div>
        </article>

        <div className="mt-24">
          <p className="max-w-[48ch] text-lead">
            The board hides likely scams by default and marks the rest, so you can skip straight to the real jobs.
          </p>
          <Link href="/" className="btn mt-8">
            See all jobs
          </Link>
        </div>
      </main>
      <JsonLd
        data={guideGraph({ path: SCAM_GUIDE_PATH, headline, description, published: SCAM_GUIDE_PUBLISHED, updated })}
      />
    </>
  );
}
