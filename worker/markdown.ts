import { MARKDOWN_HEADERS, MARKDOWN_HOME_PATH, prefersMarkdown } from "@/lib/markdown";
import type { Env } from "./env";

// Markdown for AI agents (https://acceptmarkdown.com).
//
// At /: a static file can't look at the Accept header, and running the Worker for every homepage visit would spend
// the free plan's request allowance on browsers. So a URL rewrite rule on the zone (README.md, "Hosting on
// Cloudflare") sends / here only when Accept names text/markdown. This parses the header properly (q-values, q=0)
// and answers with the Markdown copy or the HTML homepage. Browsers never send text/markdown, so they get the
// static homepage straight from the edge. A response header rule adds Vary: Accept to that one.
//
// On 404s: the Worker already runs for requests no file matches (other than browser navigations), so agents that
// prefer Markdown get a Markdown 404 there.

/** Where the zone's rewrite rule sends / when Accept names text/markdown. Listed in wrangler.jsonc's run_worker_first. */
export const AGENT_HOME_PATH = "/_agents/home";

function asset(env: Env, path: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(path, "https://assets.local")));
}

export async function agentHome(request: Request, env: Env): Promise<Response> {
  const markdown = prefersMarkdown(request.headers.get("accept"));
  const res = await asset(env, markdown ? MARKDOWN_HOME_PATH : "/");
  const headers = new Headers(res.headers);
  headers.set("Vary", "Accept");
  if (markdown) {
    for (const [key, value] of Object.entries(MARKDOWN_HEADERS)) headers.set(key, value);
    // The Markdown copy duplicates the homepage.
    headers.set("X-Robots-Tag", "noindex");
  }
  return new Response(res.body, { status: res.status, headers });
}

export function markdownNotFound(env: Env): Response {
  const url = (path: string) => new URL(path, env.SITE_URL).toString();
  const body = `# Not found

There is no page at this address. A job may have been removed or re-graded as not a job, or the link may be wrong.

- [Newest jobs](${url(MARKDOWN_HOME_PATH)}) (Markdown)
- [llms.txt](${url("/llms.txt")}): what this site is for, with every page
- [Sitemap](${url("/sitemap.xml")})
`;
  return new Response(body, { status: 404, headers: MARKDOWN_HEADERS });
}
