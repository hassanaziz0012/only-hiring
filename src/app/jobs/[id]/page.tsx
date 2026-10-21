import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DataError } from "@/components/DataError";
import { JobDetail } from "@/components/JobDetail";
import { SiteHeader } from "@/components/SiteHeader";
import { getJob, getJobs } from "@/lib/db";
import { isIndexable } from "@/lib/jobs";

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

async function Detail({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  const result = await getJob(id);
  if (!result.ok) return <DataError />;
  if (!result.job) notFound();
  return <JobDetail job={result.job} fetchedAt={result.fetchedAt} />;
}

function DetailFallback() {
  return (
    <div className="pt-4 pb-24 md:pt-8" aria-busy="true">
      <p className="text-body text-muted">Loading the job…</p>
      <div className="mt-14 h-24 max-w-2xl bg-surface" />
      <div className="mt-8 h-40 max-w-3xl bg-surface" />
    </div>
  );
}

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="shell">
        <Suspense fallback={<DetailFallback />}>
          <Detail params={params} />
        </Suspense>
      </main>
    </>
  );
}
