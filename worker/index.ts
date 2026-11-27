import { jobShard, jobShardPath, type ApiJobShard } from "@/lib/api";
import { applied } from "./applied";
import { assetJson } from "./assets";
import { auth } from "./auth";
import { accountsDb } from "./db";
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

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/auth/")) return auth(env).handler(request);
  if (pathname === "/api/applied") return applied(request, env, accountsDb(env.DATABASE_URL));
  if (pathname === "/api/feedback") return feedback(request, env, accountsDb(env.DATABASE_URL));
  if (pathname === "/mcp") return mcp(request, env);
  if (pathname === "/feed.xml") return feed(request, env);
  if (pathname.startsWith("/api/jobs/")) return jobDetail(env, decodeURIComponent(pathname.slice("/api/jobs/".length)));
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env): Promise<Response> {
    let response: Response;
    try {
      response = await route(request, env);
    } catch (error) {
      console.error("[worker]", new URL(request.url).pathname, error);
      response = Response.json({ error: "Something went wrong. Try again in a minute." }, { status: 500 });
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) if (!headers.has(key)) headers.set(key, value);
    if (env.NOINDEX === "1") headers.set("X-Robots-Tag", "noindex");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
} satisfies ExportedHandler<Env>;
