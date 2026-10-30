import type { NextConfig } from "next";
import { BEST_SUBS_PATH } from "./src/lib/subreddits";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The CSP only sets frame-ancestors, so the site can't be framed for clickjacking. A full policy would
  // need nonces or hashes for Next's inline scripts.
  // The bare /r goes to the guide that lists every subreddit page. Temporary, in case /r gets a page of its own.
  async redirects() {
    return [{ source: "/r", destination: BEST_SUBS_PATH, permanent: false }];
  },
  async rewrites() {
    return {
      beforeFiles: [],
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
