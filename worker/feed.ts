import { feedSearch, filtersFromSearch } from "@/components/board/filters";
import { buildFeed, type FeedSource } from "@/lib/feed";
import type { Job } from "@/lib/jobs";
import { assetJson } from "./assets";
import type { Env } from "./env";

// /feed.xml. Without a filter it's the static /feed-all.xml. With the board's filters
// (/feed.xml?role=web_development&mode=remote) it's built here from /api/board, which the build wrote.

const RSS = "application/rss+xml; charset=utf-8";
const CDN_CACHE = "public, max-age=900, s-maxage=1800, stale-while-revalidate=86400";

type Board = { fetchedAt: string; syncedAt?: string | null; jobs: Job[] };

export async function feed(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  // The same canonical query the board's own feed link uses; parameters it doesn't know are ignored.
  const search = feedSearch({ ...filtersFromSearch(url.search), applied: "all" });
  if (!search) {
    const res = await env.ASSETS.fetch(new Request(new URL("/feed-all.xml", url), request));
    return new Response(res.body, { status: res.status, headers: { "Content-Type": RSS, "Cache-Control": CDN_CACHE } });
  }

  const board = await assetJson<Board>(env, "/api/board");
  // "Expired" counts from now, not from the build, since a filtered feed is built per request.
  const source: FeedSource = board
    ? { ok: true, jobs: board.jobs, fetchedAt: new Date().toISOString(), syncedAt: board.syncedAt ?? null }
    : { ok: false };
  const { ok, xml } = buildFeed(source, url.search, new URL(env.SITE_URL));
  return new Response(xml, {
    // Don't let caches keep a feed without data for half an hour.
    headers: { "Content-Type": RSS, "Cache-Control": ok ? CDN_CACHE : "public, max-age=60, s-maxage=60" },
  });
}
