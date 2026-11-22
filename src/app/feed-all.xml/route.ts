import { buildFeed } from "@/lib/feed";

// The whole feed, served at /feed.xml when the URL has no filters (see rewrites in next.config.ts). It never reads
// the request, so it's prerendered and served from the CDN until the next sync clears the job list's tag: fetching
// it never runs a function or touches the database, unlike the filtered feeds.

export async function GET() {
  const { xml } = await buildFeed("");
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
