import type { MetadataRoute } from "next";
import { getJobs } from "@/lib/db";
import { isIndexable } from "@/lib/jobs";
import { SCAM_GUIDE_PATH, SCAM_GUIDE_UPDATED } from "@/lib/scam-report";
import { siteUrl } from "@/lib/site";

// No changeFrequency or priority: Google ignores both.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const result = await getJobs();
  const at = result.ok ? Date.parse(result.fetchedAt) : 0;
  const listed = result.ok ? result.jobs.filter((job) => isIndexable(job, at)) : [];

  return [
    // The homepage changes when a new job is listed, not on every sync.
    { url: url("/"), lastModified: listed[0]?.postedAt ?? undefined },
    { url: url("/about") },
    { url: url("/privacy") },
    { url: url(SCAM_GUIDE_PATH), lastModified: SCAM_GUIDE_UPDATED },
    ...listed.map((job) => ({ url: url(`/jobs/${job.id}`), lastModified: job.postedAt ?? undefined })),
  ];
}
