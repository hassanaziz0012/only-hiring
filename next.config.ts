import type { NextConfig } from "next";
import { BEST_SUBS_PATH } from "./src/lib/subreddits";

// The query parameters /feed.xml filters by: the ones feedSearch (components/board/filters.ts) can return.
const FEED_FILTERS = ["q", "role", "level", "mode", "region", "pay", "lang", "test", "commission", "native"];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // By default Next skips the CDN cache for a list of bots (Bingbot, Twitterbot, Applebot...) and renders the page
  // for each of their visits, so streamed metadata ends up in the <head>. Every page here has its metadata in the
  // prerendered <head> already, and each render can wake the database. This matches no bot, so they get the cached
  // page. (No lookaheads: the pattern also goes into Vercel's routing config.)
  htmlLimitedBots: /only-hiring-matches-no-bot/,
  // The CSP only sets frame-ancestors, so the site can't be framed for clickjacking. A full policy would
  // need nonces or hashes for Next's inline scripts.
  // The bare /r goes to the guide that lists every subreddit page. Temporary, in case /r gets a page of its own.
  async redirects() {
    return [{ source: "/r", destination: BEST_SUBS_PATH, permanent: false }];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Without a filter, the feed is a static file. With one, it's built per request by /feed.xml itself.
        { source: "/feed.xml", missing: FEED_FILTERS.map((key) => ({ type: "query" as const, key })), destination: "/feed-all.xml" },
      ],
      afterFiles: [],
      // Agents asking for Markdown get a Markdown 404 (src/app/not-found.md) when nothing else matched.
      fallback: [
        { source: "/:path*", has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }], destination: "/not-found.md" },
      ],
    };
  },
  async headers() {
    return [
      // The Markdown copy duplicates the homepage, so keep it out of search results.
      { source: "/index.md", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      // The same for the static copy of the feed when it's fetched directly.
      { source: "/feed-all.xml", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
