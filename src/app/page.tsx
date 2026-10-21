import type { Metadata } from "next";
import { BackToTop } from "@/components/BackToTop";
import { JobBoard } from "@/components/board/JobBoard";
import { DataError } from "@/components/DataError";
import { ExactTime } from "@/components/RelativeTime";
import { SiteHeader } from "@/components/SiteHeader";
import { getJobs } from "@/lib/db";
import { countLabel } from "@/lib/format";
import { isExpired, isLikelyScam } from "@/lib/jobs";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const result = await getJobs();

  let summary: React.ReactNode = null;
  if (result.ok) {
    const at = Date.parse(result.fetchedAt);
    const open = result.jobs.filter((j) => !isExpired(j, at) && !isLikelyScam(j));
    const subs = new Set(open.map((j) => j.subreddit)).size;
    summary = (
      <>
        {countLabel(open.length, "open job")} from {countLabel(subs, "subreddit")}.
        {result.syncedAt && (
          <>
            {" "}
            Last updated <ExactTime iso={result.syncedAt} />.
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className="bg-mint text-mint-ink">
        <SiteHeader />
        <section className="shell pt-8 pb-12 md:pt-12 md:pb-16" aria-labelledby="page-title">
          <h1 id="page-title" className="display masthead-tag bracketed -ml-[0.04em] [--arm:0.3em] [--bw:0.085em]">
            <span className="block">reddit&apos;s job posts,</span>
            <span className="block">minus the noise.</span>
          </h1>
          <div className="rise mt-8 grid gap-x-10 gap-y-4 md:mt-10 md:grid-cols-12" style={{ "--delay": "260ms" } as React.CSSProperties}>
            <p className="text-lead md:col-span-7 lg:col-span-6">
              A Reddit job board with only the hiring posts. Most posts on r/forhire, r/hiring and the other job
              subreddits are people selling their own services. We read every post, list only the ones that are hiring,
              flag likely scams, and link back to the original.
            </p>
            {summary && <p className="self-end text-body md:col-span-5 md:text-right lg:col-span-6">{summary}</p>}
          </div>
        </section>
      </div>

      <main id="main">
        {result.ok ? (
          // The list never shows post bodies, so leave them out of the page payload.
          <JobBoard jobs={result.jobs.map((job) => ({ ...job, bodyExcerpt: null }))} fetchedAt={result.fetchedAt} />
        ) : (
          <DataError />
        )}
      </main>
      <BackToTop />
    </>
  );
}
