import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataError } from "@/components/DataError";
import { JobDetail } from "@/components/JobDetail";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllJobIds, getJob, getJobTitle } from "@/lib/data";
import { isIndexable } from "@/lib/jobs";
import { jobGraph, JsonLd } from "@/lib/jsonld";
import { jobPageTitles } from "@/lib/page-title";

// Unlisted IDs never match a job, so the placeholder renders the not-found page.
const PLACEHOLDER_ID = "_";

// Every job is built, however old: the site is a static export, so an ID that isn't built gets the 404 page.
export function generateStaticParams() {
  const ids = getAllJobIds();
  return ids.length ? ids.map((id) => ({ id })) : [{ id: PLACEHOLDER_ID }];
}

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const result = await getJob(id);
  const job = result.ok ? result.job : null;
  if (!result.ok || !job) return { title: "Job not found", robots: { index: false } };
  const description = job.summary.length > 200 ? `${job.summary.slice(0, 197).trimEnd()}…` : job.summary;
  return {
    // Absolute: the site name would use a quarter of the space, and Google shows it from the WebSite JSON-LD.
    title: { absolute: getJobTitle(id) ?? jobPageTitles([job]).get(job.id) ?? job.jobTitle },
    description,
    alternates: { canonical: `/jobs/${job.id}` },
    // Same rule as the sitemap: likely scams, expired, adult and thin posts stay out of search results.
    ...(isIndexable(job, Date.parse(result.fetchedAt)) ? {} : { robots: { index: false, follow: true } }),
    // A page-level openGraph replaces the inherited one. The image is the job's own, from opengraph-image.tsx.
    openGraph: { type: "article", title: job.jobTitle, description, url: `/jobs/${job.id}` },
    twitter: { card: "summary_large_image", title: job.jobTitle, description },
  };
}

// An unknown ID (only the placeholder, in a build without data) renders the not-found page.
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
