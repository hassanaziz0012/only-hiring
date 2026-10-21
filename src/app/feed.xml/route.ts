import { getJobs } from "@/lib/db";
import { formatPay } from "@/lib/format";
import { isIndexable } from "@/lib/jobs";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

// RSS 2.0 feed of the newest open jobs, for feed readers and aggregators. Built from the cached job
// list like the sitemap, so it refreshes with it.

const FEED_SIZE = 50;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function GET() {
  const result = await getJobs();
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const at = result.ok ? Date.parse(result.fetchedAt) : 0;
  // Same set search engines get: no likely scams, expired or adult posts.
  const jobs = result.ok ? result.jobs.filter((job) => isIndexable(job, at)).slice(0, FEED_SIZE) : [];

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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(`${SITE_NAME}: newest hiring posts from Reddit`)}</title>
    <link>${url("/")}</link>
    <atom:link href="${url("/feed.xml")}" rel="self" type="application/rss+xml" />
    <description>${escape(SITE_DESCRIPTION)}</description>
    <language>en-GB</language>
    ${result.ok && result.syncedAt ? `<lastBuildDate>${new Date(result.syncedAt).toUTCString()}</lastBuildDate>` : ""}
${items.join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
