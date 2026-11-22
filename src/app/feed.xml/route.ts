import type { NextRequest } from "next/server";
import { buildFeed } from "@/lib/feed";

// The feed narrowed by the board's filters (see lib/feed.ts). Reading the query makes the route run per request,
// so the CDN caches each URL for a while. Without a filter, next.config.ts serves the static copy at
// /feed-all.xml instead.

const CDN_CACHE = "public, max-age=900, s-maxage=1800, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const { ok, xml } = await buildFeed(request.nextUrl.search);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Don't let the CDN keep a feed without data for half an hour.
      "Cache-Control": ok ? CDN_CACHE : "public, max-age=60, s-maxage=60",
    },
  });
}
