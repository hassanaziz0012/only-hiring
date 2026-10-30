// Markdown for AI agents. Agents that send `Accept: text/markdown` get a Markdown homepage (/index.md) and
// Markdown 404s instead of HTML; see src/proxy.ts and the fallback rewrite in next.config.ts.
// Follows https://acceptmarkdown.com: parse Accept properly and send Vary: Accept with every negotiated response.
// Pure functions: imported by the proxy as well as the routes.

/** The Markdown copy of the homepage, served at / to agents that ask for Markdown. */
export const MARKDOWN_HOME_PATH = "/index.md";

/** How many of the newest jobs the Markdown homepage lists. Keeps it far below an agent's context window. */
export const MARKDOWN_HOME_JOBS = 50;

/** Headers for a Markdown response to a negotiated URL. */
export const MARKDOWN_HEADERS = { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" };

type Rank = { q: number; specificity: number };

/** How much the Accept header wants a media type: q from the most specific range that matches it. */
function rank(ranges: { type: string; q: number }[], type: string): Rank {
  const [major] = type.split("/");
  let best: Rank = { q: 0, specificity: -1 };
  for (const range of ranges) {
    const specificity = range.type === type ? 2 : range.type === `${major}/*` ? 1 : range.type === "*/*" ? 0 : -1;
    if (specificity > best.specificity) best = { q: range.q, specificity };
  }
  return best;
}

/**
 * True when the Accept header prefers Markdown to HTML: a higher q, or the same q from a more specific
 * range ("text/markdown, *\/*"). A tie on both still goes to Markdown, since only agents name text/markdown at
 * all. A missing header, "*\/*" or anything that doesn't name Markdown gets HTML, and q=0 always refuses it.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const ranges = accept.split(",").map((part) => {
    const [type, ...params] = part.split(";").map((s) => s.trim().toLowerCase());
    const qParam = params.find((p) => p.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    return { type, q: Number.isFinite(q) ? Math.min(Math.max(q, 0), 1) : 0 };
  });
  const markdown = rank(ranges, "text/markdown");
  const html = rank(ranges, "text/html");
  if (markdown.specificity < 2 || markdown.q === 0) return false;
  return markdown.q > html.q || (markdown.q === html.q && markdown.specificity >= html.specificity);
}

/** Escapes text for a Markdown line: collapses newlines and backslash-escapes the characters that format. */
export function markdownText(s: string): string {
  return s.replace(/\s+/g, " ").trim().replace(/([\\`*_[\]<>#|])/g, "\\$1");
}
