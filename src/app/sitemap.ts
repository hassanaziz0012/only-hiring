import type { MetadataRoute } from "next";
import { getJobs } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const result = await getJobs();
  const lastModified = result.ok && result.syncedAt ? result.syncedAt : undefined;

  return [
    { url: url("/"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.3 },
    ...(result.ok
      ? result.jobs.map((job) => ({
          url: url(`/jobs/${job.id}`),
          lastModified: job.postedAt ?? undefined,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }))
      : []),
  ];
}
