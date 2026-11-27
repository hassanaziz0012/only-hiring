import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// The site is a static export: `next build` writes every page, image, feed and JSON file to out/, and Cloudflare
// serves them as static assets (wrangler.jsonc). Nothing renders per request. The few routes that need a server
// (sign-in, applied marks, feedback, /mcp and filtered feeds) live in the Worker, worker/index.ts.
//
// A static export ignores headers(), redirects() and rewrites(), so scripts/cloudflare-assets.mjs writes them to
// out/_headers and out/_redirects after the build.

// The Worker's routes. In development `next dev` hands them to `wrangler dev` (npm run dev:worker).
const WORKER_ROUTES = ["/api/auth/:path*", "/api/applied", "/api/feedback", "/mcp", "/feed.xml"];
const WORKER_DEV_ORIGIN = process.env.WORKER_DEV_ORIGIN ?? "http://localhost:8787";

export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    // Only for builds: in development, rewrites (below) are needed to reach the Worker.
    ...(dev ? {} : { output: "export" as const }),
    ...(dev && {
      async rewrites() {
        return WORKER_ROUTES.map((source) => ({ source, destination: `${WORKER_DEV_ORIGIN}${source}` }));
      },
    }),
    images: { unoptimized: true },
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };
}
