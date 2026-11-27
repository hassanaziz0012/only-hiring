import { getJobs } from "@/lib/data";
import { buildFeed } from "@/lib/feed";

// The whole feed. The Worker serves it at /feed.xml when the URL has no filters (worker/index.ts), and builds the
// filtered ones itself.

export const dynamic = "force-static";

export async function GET() {
  const { xml } = buildFeed(await getJobs(), "");
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
