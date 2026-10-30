import { getJobs } from "@/lib/db";
import { countLabel, dayKey, exactDate, formatPay, locationText, workModeText } from "@/lib/format";
import { isExpired, isIndexable, isLikelyScam, scamWarningLabel } from "@/lib/jobs";
import { EMPLOYMENT_LABELS, labelFor } from "@/lib/labels";
import { MARKDOWN_HEADERS, MARKDOWN_HOME_JOBS, markdownText } from "@/lib/markdown";
import { SCAM_HIDE_THRESHOLD, SCAM_WARN_THRESHOLD, SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import { SUBREDDITS, subredditLive, subredditPath } from "@/lib/subreddits";

// The homepage as Markdown, for AI agents: served at / when Accept prefers text/markdown (see src/proxy.ts),
// and here directly. The HTML homepage lists every open job, which runs past what an agent can read, so this
// lists the newest few and points to the subreddit pages for the rest. Built from the cached job list like the feed.

const MAX_SKILLS = 6;

export async function GET() {
  const result = await getJobs();
  const url = (path: string) => new URL(path, siteUrl()).toString();
  const lines: string[] = [`# ${SITE_NAME}: Reddit job board, hiring posts only`, "", `> ${SITE_DESCRIPTION}`, ""];

  if (!result.ok) {
    lines.push("The job list can't be loaded right now. Try again in a few minutes.", "");
  } else {
    const at = Date.parse(result.fetchedAt);
    // Same counts as the HTML homepage; the list is the feed's set: no likely scams, expired, adult or thin posts.
    const open = result.jobs.filter((j) => !isExpired(j, at) && !isLikelyScam(j));
    const listed = result.jobs.filter((j) => isIndexable(j, at)).slice(0, MARKDOWN_HOME_JOBS);
    const subs = SUBREDDITS.map((s) => ({ name: s.name, open: subredditLive(result.jobs, s.name, at).open.length }))
      .filter((s) => s.open > 0)
      .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

    lines.push(
      `${countLabel(open.length, "open job")} from ${countLabel(new Set(open.map((j) => j.subreddit)).size, "subreddit")}.` +
        (result.syncedAt ? ` Last updated ${exactDate(result.syncedAt, "UTC")} UTC.` : ""),
      "",
      `This is the Markdown version of ${url("/")}. It lists the newest ${listed.length}; the subreddit pages below list the rest.`,
      `Posts with a scam score of ${SCAM_HIDE_THRESHOLD} or more are left out, and ${SCAM_WARN_THRESHOLD} or more carry a warning.`,
      "To apply, open the original Reddit post linked from each job page.",
      "",
      "## Newest jobs",
      "",
    );

    for (const job of listed) {
      const pay = formatPay(job);
      const where = [workModeText(job), locationText(job)].filter(Boolean).join(", ");
      const employment = labelFor(EMPLOYMENT_LABELS, job.employmentType);
      const warning = scamWarningLabel(job);
      lines.push(`### [${markdownText(job.jobTitle)}](${url(`/jobs/${job.id}`)})`, "");
      lines.push(`- Posted${job.postedAt ? ` ${dayKey(job.postedAt, "UTC")}` : ""} in r/${job.subreddit}`);
      lines.push(`- Pay: ${markdownText(pay.text)}`);
      if (where) lines.push(`- Where: ${markdownText(where)}`);
      if (employment) lines.push(`- Type: ${employment}`);
      if (job.skills.length) lines.push(`- Skills: ${markdownText(job.skills.slice(0, MAX_SKILLS).join(", "))}`);
      if (warning) lines.push(`- ${warning} (scam score ${job.scamScore})`);
      lines.push(`- Original post: ${job.redditUrl}`, "", markdownText(job.summary), "");
    }

    lines.push("## Open jobs by subreddit", "");
    for (const s of subs) lines.push(`- [r/${s.name}](${url(subredditPath(s.name))}): ${countLabel(s.open, "open job")}`);
    lines.push("");
  }

  lines.push(
    "## More",
    "",
    `- [llms.txt](${url("/llms.txt")}): what this site is for and when to use it, with every page`,
    `- [How it works](${url("/about")}): pipeline, scam scoring, data policy`,
    `- [RSS feed](${url("/feed.xml")}): the newest open jobs`,
    `- [Sitemap](${url("/sitemap.xml")})`,
    "",
  );

  return new Response(lines.join("\n"), { headers: MARKDOWN_HEADERS });
}
