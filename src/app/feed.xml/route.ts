import type { NextRequest } from "next/server";
import { feedSearch, filterSummary, filtersFromSearch, matches } from "@/components/board/filters";
import { getJobs } from "@/lib/db";
import { formatPay } from "@/lib/format";
import { isIndexable } from "@/lib/jobs";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

// RSS 2.0 feed of the newest open jobs, for feed readers and aggregators. Built from the cached job list like the
// sitemap, so it refreshes with it.
//
// It takes the board's query string, so /feed.xml?role=web_development&mode=remote lists what
// /?role=web_development&mode=remote shows, newest first. Reading the query makes the route run per request, so the
// CDN caches each URL for a while.

const FEED_SIZE = 50;

const CDN_CACHE = "public, max-age=900, s-maxage=1800, stale-while-revalidate=86400";

const NO_APPLIED: ReadonlySet<string> = new Set();

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function GET(request: NextRequest) {
  const result = await getJobs();
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const at = result.ok ? Date.parse(result.fetchedAt) : 0;

  // A feed has no visitor whose applied jobs it could hide or show, so that filter is ignored (see feedSearch).
  const filters = { ...filtersFromSearch(request.nextUrl.search), applied: "all" as const };
  const search = feedSearch(filters);
  const summary = filterSummary(filters);

  // Same set search engines get (no likely scams, expired, adult or thin posts), narrowed by the board's filters.
  const jobs = result.ok
    ? result.jobs.filter((job) => isIndexable(job, at) && matches(job, filters, NO_APPLIED)).slice(0, FEED_SIZE)
    : [];

  const items = jobs.map((job) => {
    const pay = formatPay(job);
    const description = pay.stated ? `${pay.text}. ${job.summary}` : job.summary;
    return `    <item>
      <title>${escape(`${job.jobTitle} (r/${job.subreddit})`)}</title>
      <link>${url(`/jobs/${job.id}`)}</link>
      <guid isPermaLink="true">${url(`/jobs/${job.id}`)}</guid>
      ${job.postedAt ? `<pubDate>${new Date(job.postedAt).toUTCString()}</pubDate>` : ""}
      <category>${escape(`r/${job.subreddit}`)}</category>
      <description>${escape(description)}</description>
    </item>`;
  });

  const title = summary ? `${SITE_NAME}: ${summary}` : `${SITE_NAME}: newest hiring posts from Reddit`;
  const description = summary ? `Newest hiring posts from Reddit with these filters: ${summary}. ${SITE_DESCRIPTION}` : SITE_DESCRIPTION;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(title)}</title>
    <link>${escape(url(`/${search}`))}</link>
    <atom:link href="${escape(url(`/feed.xml${search}`))}" rel="self" type="application/rss+xml" />
    <description>${escape(description)}</description>
    <language>en-GB</language>
    ${result.ok && result.syncedAt ? `<lastBuildDate>${new Date(result.syncedAt).toUTCString()}</lastBuildDate>` : ""}
${items.join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Don't let the CDN keep a failed read for half an hour.
      "Cache-Control": result.ok ? CDN_CACHE : "public, max-age=60, s-maxage=60",
    },
  });
}
