import { NextResponse, type NextRequest } from "next/server";
import { MARKDOWN_HOME_PATH, prefersMarkdown } from "@/lib/markdown";

// Agents that prefer Markdown get /index.md at /. The matcher only lets requests whose Accept names
// text/markdown through, so browsers never run this, and the rewrite happens before the CDN cache lookup, so
// the HTML and Markdown copies are cached under different paths and can't be served to the wrong visitor.

export function proxy(request: NextRequest) {
  if (prefersMarkdown(request.headers.get("accept"))) {
    return NextResponse.rewrite(new URL(MARKDOWN_HOME_PATH, request.url));
  }
}

export const config = {
  matcher: [{ source: "/", has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }] }],
};
