import { SCAM_GUIDE_PATH } from "@/lib/scam-report";
import { EXPIRY_DAYS, MAKER, SCAM_HIDE_THRESHOLD, SCAM_WARN_THRESHOLD, SITE_NAME, SOURCE_URL, siteUrl } from "@/lib/site";

// llms.txt (https://llmstxt.org): a plain summary of the site for language models. Google ignores it,
// but answer engines may read it. Built from the site constants so the thresholds can't drift.

export function GET() {
  const url = (path: string) => new URL(path, siteUrl()).toString();

  const text = `# ${SITE_NAME}

> ${SITE_NAME} (${url("/")}) is a free job board listing genuine hiring posts from Reddit's job subreddits. A language model filters out self-promotion ([For Hire] posts), discussion and spam, summarises each post, extracts pay, skills and location, and gives it a 0–1 scam score. Built by ${MAKER.name}; launched October 2026.

- About three in four posts on these subreddits are not hiring posts and are excluded.
- Posts scoring ${SCAM_WARN_THRESHOLD} or more carry a scam warning; ${SCAM_HIDE_THRESHOLD} or more are hidden by default.
- Applications happen on Reddit; the site keeps only a post's opening lines.
- Posts older than ${EXPIRY_DAYS} days move to a collapsed list.

## Pages
- [How it works](${url("/about")}): pipeline, scam scoring, source subreddits, data policy
- [Current jobs](${url("/")}): live list, newest first
- [Reddit job scams](${url(SCAM_GUIDE_PATH)}): how scams on Reddit's job subreddits work, with figures from the jobs this site has graded
- [RSS feed](${url("/feed.xml")}): the newest open jobs
- [Sitemap](${url("/sitemap.xml")})

## Optional
${SOURCE_URL ? `- [Source code](${SOURCE_URL}): the website, MIT-licensed\n` : ""}- [Maker](${MAKER.url})
- [Privacy](${url("/privacy")})
`;

  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
