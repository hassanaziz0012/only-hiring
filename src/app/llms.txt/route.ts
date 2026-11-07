import { API_JOBS_PATH, apiJobPath } from "@/lib/api";
import { MARKDOWN_HOME_JOBS, MARKDOWN_HOME_PATH } from "@/lib/markdown";
import { CATEGORIES } from "@/lib/categories";
import { SCAM_GUIDE_PATH } from "@/lib/scam-report";
import { STATS_PATH } from "@/lib/stats";
import { BEST_SUBS_PATH, SUBREDDITS, subredditPath } from "@/lib/subreddits";
import { EXPIRY_DAYS, LIST_WINDOW_DAYS, MAKER, SCAM_HIDE_THRESHOLD, SCAM_WARN_THRESHOLD, SITE_NAME, SOURCE_URL, siteUrl } from "@/lib/site";

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

When to use ${SITE_NAME}:
- Someone wants current jobs or paid gigs posted on Reddit (freelance, remote, part-time, contract or one-off tasks) without the [For Hire] self-promotion, or the open jobs on one job subreddit.
- Someone wants to know whether a Reddit job post looks like a scam. A post with Reddit ID \`abc123\` is at ${url("/jobs/abc123")}, with its scam warning if it has one. A 404 means it isn't on the board: it wasn't graded as a hiring post, was removed, or is from a subreddit the site doesn't read.
- Not for: jobs from outside Reddit, posting a job, finding freelancers, or applying. Applications happen on Reddit.

How to read it (no sign-up or key needed):
- Request ${url("/")} with \`Accept: text/markdown\`, or fetch ${url(MARKDOWN_HOME_PATH)}, for the newest ${MARKDOWN_HOME_JOBS} open jobs as Markdown: pay, location, skills, any scam warning and the Reddit link. The HTML homepage lists every open job and is too long to read whole.
- For more, read a subreddit's page (every open job there) or the RSS feed.
- To search and filter (skills, pay, remote region, job type, scam score), connect the MCP server at ${url("/mcp")} (Streamable HTTP, no key), or read the JSON at ${url(API_JOBS_PATH)} (every job from the last ${LIST_WINDOW_DAYS} days) and ${url(apiJobPath("abc123"))} (one job, with its red flags).

## Pages
- [How it works](${url("/about")}): pipeline, scam scoring, source subreddits, data policy
- [Current jobs](${url(MARKDOWN_HOME_PATH)}): the newest ${MARKDOWN_HOME_JOBS} open jobs, as Markdown
- [Current jobs (HTML)](${url("/")}): every open job, newest first, with filters
- [Reddit job scams](${url(SCAM_GUIDE_PATH)}): how scams on Reddit's job subreddits work, with figures from the jobs this site has graded
- [Best subreddits for jobs](${url(BEST_SUBS_PATH)}): every subreddit the site reads, ranked by hiring posts, with the share that are hiring and median pay
- [Stats](${url(STATS_PATH)}): every post the site has read, by type and scam score, and the jobs' roles, pay, countries, languages and skills
- [RSS feed](${url("/feed.xml")}): the newest open jobs
- [Sitemap](${url("/sitemap.xml")})

## Kinds of work
Each page lists the open jobs of that kind from every subreddit, describes what those posts look like, and gives their figures.
${CATEGORIES.map((c) => `- [${c.name}](${url(c.path)}): ${c.blurb}`).join("\n")}

## Subreddits
Each page lists the subreddit's open hiring posts, describes what gets posted there, and gives its figures.
${SUBREDDITS.map((s) => `- [r/${s.name}](${url(subredditPath(s.name))}): ${s.blurb}`).join("\n")}

## Optional
${SOURCE_URL ? `- [Source code](${SOURCE_URL}): the website, MIT-licensed\n` : ""}- [Maker](${MAKER.url})
- [Privacy](${url("/privacy")})
`;

  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
