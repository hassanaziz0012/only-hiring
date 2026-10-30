import { MARKDOWN_HEADERS, MARKDOWN_HOME_PATH, prefersMarkdown } from "@/lib/markdown";
import { siteUrl } from "@/lib/site";

// The 404 for agents: next.config.ts rewrites here when no page matched and Accept names text/markdown.
// A client that names Markdown but prefers HTML gets a short HTML 404 instead.

export function GET(request: Request) {
  const url = (path: string) => new URL(path, siteUrl()).toString();

  if (!prefersMarkdown(request.headers.get("accept"))) {
    return new Response(`<!DOCTYPE html><title>Not found</title><p>Nothing here. <a href="/">See all jobs</a>.</p>\n`, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", Vary: "Accept" },
    });
  }

  const body = `# Not found

There is no page at this address. A job may have been removed or re-graded as not a job, or the link may be wrong.

- [Newest jobs](${url(MARKDOWN_HOME_PATH)}) (Markdown)
- [llms.txt](${url("/llms.txt")}): what this site is for, with every page
- [Sitemap](${url("/sitemap.xml")})
`;
  return new Response(body, { status: 404, headers: MARKDOWN_HEADERS });
}
