import type { Pool } from "@neondatabase/serverless";
import { jobShard, jobShardPath, type ApiJobShard } from "@/lib/api";
import { applied } from "./applied";
import { assetJson } from "./assets";
import { accountsDb, createAuth } from "./auth";
import type { Env } from "./env";
import { feed } from "./feed";
import { feedback } from "./feedback";
import { mcp } from "./mcp";

// The site's only server code. Everything else is a static file from the Next.js export (out/), served by
// Cloudflare without running this Worker at all, which costs nothing and counts toward no limit.
//
// wrangler.jsonc's run_worker_first lists the paths that reach this Worker. Keep the two in step. Other requests
// get here only when no file matches and they aren't a browser navigation (fetch() calls, bots); those are handed
// back to the assets, which answer with the 404 page.

// The headers out/_headers gives the static files. Cloudflare doesn't apply that file to a Worker's responses.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
};

const CORS = { "Access-Control-Allow-Origin": "*" };

async function jobDetail(env: Env, id: string): Promise<Response> {
  const shard = /^[a-z0-9]{1,16}$/.test(id) ? await assetJson<ApiJobShard>(env, jobShardPath(jobShard(id))) : {};
  if (!shard) {
    return Response.json({ error: "This job can't be loaded right now. Try again in a few minutes." }, { status: 503, headers: CORS });
  }
  const job = shard[id];
  if (!job) return Response.json({ error: "No job with this ID is on the board." }, { status: 404, headers: CORS });
  return Response.json(job, { headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
}

async function route(request: Request, env: Env, db: () => Pool): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/auth/")) return createAuth(env, db()).handler(request);
  if (pathname === "/api/applied") return applied(request, env, db());
  if (pathname === "/api/feedback") return feedback(request, env, db());
  if (pathname === "/mcp") return mcp(request, env);
  if (pathname === "/feed.xml") return feed(request, env);
  if (pathname.startsWith("/api/jobs/")) return jobDetail(env, decodeURIComponent(pathname.slice("/api/jobs/".length)));
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    // One database pool per request (see worker/auth.ts), opened on first use and closed once the handler is done.
    const opened: { pool?: Pool } = {};
    const db = () => (opened.pool ??= accountsDb(env));

    let response: Response;
    try {
      response = await route(request, env, db);
    } catch (error) {
      console.error("[worker]", new URL(request.url).pathname, error);
      response = Response.json({ error: "Something went wrong. Try again in a minute." }, { status: 500 });
    }
    if (opened.pool) ctx.waitUntil(opened.pool.end().catch(() => {}));

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) if (!headers.has(key)) headers.set(key, value);
    if (env.NOINDEX === "1") headers.set("X-Robots-Tag", "noindex");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
} satisfies ExportedHandler<Env>;
