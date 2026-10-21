import type { MetadataRoute } from "next";
import { getJobs } from "@/lib/db";
import { isIndexable } from "@/lib/jobs";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const result = await getJobs();
  const lastModified = result.ok && result.syncedAt ? result.syncedAt : undefined;
  const at = result.ok ? Date.parse(result.fetchedAt) : 0;

  return [
    { url: url("/"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.3 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.1 },
    ...(result.ok
      ? result.jobs.filter((job) => isIndexable(job, at)).map((job) => ({
          url: url(`/jobs/${job.id}`),
          lastModified: job.postedAt ?? undefined,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }))
      : []),
  ];
}
