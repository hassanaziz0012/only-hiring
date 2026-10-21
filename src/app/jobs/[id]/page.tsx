import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataError } from "@/components/DataError";
import { JobDetail } from "@/components/JobDetail";
import { SiteHeader } from "@/components/SiteHeader";
import { getJob, getJobs } from "@/lib/db";
import { isIndexable } from "@/lib/jobs";
import { jobGraph, JsonLd } from "@/lib/jsonld";

// Make the first request for an ID the build didn't list wait for the full page instead of getting the
// App Shell with a 200, so an unknown ID can still answer 404 (see JobPage).
export const ensureStatic = "navigation";

// Unlisted IDs never match a job, so the placeholder renders the not-found page.
const PLACEHOLDER_ID = "_";

export async function generateStaticParams() {
  const result = await getJobs();
  if (!result.ok || result.jobs.length === 0) return [{ id: PLACEHOLDER_ID }];
  return result.jobs.map((job) => ({ id: job.id }));
}

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const result = await getJob(id);
  if (!result.ok || !result.job) return { title: "Job not found", robots: { index: false } };
  const { job } = result;
  const description = job.summary.length > 200 ? `${job.summary.slice(0, 197).trimEnd()}…` : job.summary;
  return {
    title: `${job.jobTitle} (r/${job.subreddit})`,
    description,
    alternates: { canonical: `/jobs/${job.id}` },
    // Same rule as the sitemap: likely scams, expired and adult posts stay out of search results.
    ...(isIndexable(job, Date.parse(result.fetchedAt)) ? {} : { robots: { index: false, follow: true } }),
    // A page-level openGraph replaces the inherited one, so the shared image is listed again.
    openGraph: { type: "article", title: job.jobTitle, description, url: `/jobs/${job.id}`, images: ["/opengraph-image"] },
    twitter: { card: "summary_large_image", title: job.jobTitle, description, images: ["/opengraph-image"] },
  };
}

// Resolve the job before anything streams, so an unknown ID gets a real 404 status rather than a 200
// with a not-found body. getJob reads the cached job list, so this is cheap.
export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const result = await getJob(id);
  if (result.ok && !result.job) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main" className="shell">
        {result.ok && result.job ? (
          <>
            <JobDetail job={result.job} fetchedAt={result.fetchedAt} />
            <JsonLd data={jobGraph(result.job)} />
          </>
        ) : (
          <DataError />
        )}
      </main>
    </>
  );
}
