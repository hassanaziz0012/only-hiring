import type { MetadataRoute } from "next";
import { getJobs } from "@/lib/db";
import { isIndexable } from "@/lib/jobs";
import { SCAM_GUIDE_PATH, SCAM_GUIDE_UPDATED } from "@/lib/scam-report";
import { siteUrl } from "@/lib/site";
import { BEST_SUBS_PATH, isSubredditIndexable, SUBREDDIT_SNAPSHOT_DATE, subredditLive, subredditPath, SUBREDDITS } from "@/lib/subreddits";

// No changeFrequency or priority: Google ignores both.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const result = await getJobs();
  const at = result.ok ? Date.parse(result.fetchedAt) : 0;
  const listed = result.ok ? result.jobs.filter((job) => isIndexable(job, at)) : [];
  // Same rule as the subreddit pages' robots tag: only subreddits with enough open jobs.
  const subs = result.ok
    ? SUBREDDITS.map((s) => ({ s, live: subredditLive(result.jobs, s.name, at) })).filter(({ live }) => isSubredditIndexable(live))
    : [];

  return [
    // The homepage changes when a new job is listed, not on every sync.
    { url: url("/"), lastModified: listed[0]?.postedAt ?? undefined },
    { url: url("/about") },
    { url: url("/privacy") },
    { url: url(SCAM_GUIDE_PATH), lastModified: SCAM_GUIDE_UPDATED },
    { url: url(BEST_SUBS_PATH), lastModified: SUBREDDIT_SNAPSHOT_DATE },
    ...subs.map(({ s, live }) => ({ url: url(subredditPath(s.name)), lastModified: live.open[0]?.postedAt ?? undefined })),
    ...listed.map((job) => ({ url: url(`/jobs/${job.id}`), lastModified: job.postedAt ?? undefined })),
  ];
}
