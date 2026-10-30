// What the MCP server's tools do with the JSON from /api/jobs: the search filters, and the Markdown each tool
// returns. Pure functions over ApiJob, so the route only fetches and wires them up (see src/app/mcp/route.ts).
// Every job carries its scam warning on the line under its title, so an assistant can't quote a job without it.

import { z } from "zod";
import type { ApiJob, ApiJobDetail, ApiJobList } from "./api";
import { countLabel, dayKey, relativeTime } from "./format";
import { EMPLOYMENT_LABELS, labelFor, LANGUAGE_LEVEL_LABELS, PAY_TYPE_LABELS, ROLE_LABELS, SENIORITY_LABELS, TEST_TASK_LABELS, WORK_MODE_LABELS } from "./labels";
import { EXPIRY_DAYS, LIST_WINDOW_DAYS, SCAM_HIDE_THRESHOLD, SCAM_WARN_THRESHOLD, SITE_NAME } from "./site";
import { SUBREDDITS, subredditPath } from "./subreddits";

/** Added to every link to this site, so visits from assistants show up as their own source in analytics. */
export const MCP_REF = "mcp";

export const SERVER_INSTRUCTIONS = `${SITE_NAME} lists hiring posts from Reddit's job subreddits (r/forhire, r/hiring, r/RemoteJobs and more): freelance, remote, part-time, contract and one-off paid tasks. [For Hire] self-promotion, discussion and spam are filtered out, and a language model gives each job a 0–1 scam score.
- Use search_jobs to find jobs, get_job for one job's full details and the reasons behind its scam score, and list_subreddits to see which subreddits are covered.
- Jobs scoring ${SCAM_WARN_THRESHOLD} or more carry a warning, and ${SCAM_HIDE_THRESHOLD} or more are likely scams, left out of searches unless asked for. Always pass a job's warning on to the user.
- Applications happen on Reddit, through the original post. Give the user the ${SITE_NAME} link and the Reddit link for each job you mention.
- Not for: jobs from outside Reddit, posting a job, finding freelancers, or applying on the user's behalf.`;

const keys = (map: Record<string, string>) => Object.keys(map) as [string, ...string[]];
const labelList = (map: Record<string, string>) => Object.entries(map).map(([k, v]) => `${k} (${v})`).join(", ");

export const searchInput = z.object({
  query: z
    .string()
    .max(200)
    .optional()
    .describe("Words to look for in the job title, summary, skills and role, e.g. \"python scraper\". Every word must match."),
  skills: z
    .array(z.string().max(60))
    .max(10)
    .optional()
    .describe("Skills the job must list, e.g. [\"React\", \"TypeScript\"]. Every skill must match one of the job's skills."),
  employment_type: z.array(z.enum(keys(EMPLOYMENT_LABELS))).optional().describe(`Any of: ${labelList(EMPLOYMENT_LABELS)}.`),
  role: z.array(z.enum(keys(ROLE_LABELS))).optional().describe("Any of these role categories."),
  work_mode: z.array(z.enum(keys(WORK_MODE_LABELS))).optional().describe("Any of: remote, hybrid, onsite."),
  region: z
    .string()
    .max(60)
    .optional()
    .describe("A country or region the user is in, e.g. \"Canada\" or \"EU\". Keeps remote jobs open worldwide or to that region, and jobs located there."),
  pay_type: z.enum(keys(PAY_TYPE_LABELS)).optional().describe(`How the job pays. Required with min_pay. Any of: ${labelList(PAY_TYPE_LABELS)}.`),
  min_pay: z
    .number()
    .positive()
    .optional()
    .describe("Lowest acceptable pay in pay_type units, e.g. 40 with pay_type hourly for $40/hr. Compared with the top of each job's stated range; jobs that state no amount are left out."),
  currency: z.string().length(3).default("USD").describe("ISO currency code that min_pay is in. Only jobs paying in this currency pass a min_pay filter."),
  subreddit: z.string().max(40).optional().describe("Only jobs from this subreddit, e.g. \"forhire\". See list_subreddits."),
  posted_within_days: z
    .number()
    .int()
    .min(1)
    .max(LIST_WINDOW_DAYS)
    .default(EXPIRY_DAYS)
    .describe(`Only jobs posted in the last N days, up to ${LIST_WINDOW_DAYS}. The board treats jobs older than ${EXPIRY_DAYS} days as likely filled.`),
  max_scam_score: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(`Highest scam score to include, 0–1. Defaults to leaving out likely scams (${SCAM_HIDE_THRESHOLD} or more). Use ${SCAM_WARN_THRESHOLD - 0.01} for only jobs without a warning.`),
  limit: z.number().int().min(1).max(50).default(15).describe("Most jobs to return, newest first."),
});

export type SearchInput = z.infer<typeof searchInput>;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether text contains term as a whole word ("full" matches "Full-time", "us" doesn't match "Australia"). */
function hasWord(text: string | null, term: string, prefix = false): boolean {
  if (!text) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}${prefix ? "" : "($|[^\\p{L}\\p{N}])"}`, "iu").test(text);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The jobs matching every filter, newest first. Adult posts are never returned. */
export function searchJobs(jobs: ApiJob[], input: SearchInput, now: number): ApiJob[] {
  const words = (input.query ?? "").split(/\s+/).filter(Boolean);
  const skills = (input.skills ?? []).map((s) => s.trim()).filter(Boolean);
  const sub = input.subreddit?.trim().replace(/^\/?r\//i, "").toLowerCase();
  const region = input.region?.trim();
  const currency = input.currency.toUpperCase();
  const since = now - input.posted_within_days * DAY_MS;

  return jobs.filter((job) => {
    if (job.adult || !job.postedAt || Date.parse(job.postedAt) < since) return false;
    const score = job.scam.score;
    if (score != null && (input.max_scam_score == null ? score >= SCAM_HIDE_THRESHOLD : score > input.max_scam_score)) return false;
    if (sub && job.subreddit.toLowerCase() !== sub) return false;
    if (input.employment_type && !input.employment_type.includes(job.employmentType ?? "")) return false;
    if (input.role && !input.role.includes(job.role ?? "")) return false;
    if (input.work_mode && !input.work_mode.includes(job.workMode ?? "")) return false;
    if (input.pay_type && job.pay.type !== input.pay_type) return false;
    if (input.min_pay != null) {
      const top = job.pay.max ?? job.pay.min;
      if (top == null || top < input.min_pay || job.pay.currency !== currency) return false;
    }
    if (skills.length && !skills.every((s) => job.skills.some((js) => hasWord(js, s)))) return false;
    if (region) {
      const open =
        (job.workMode === "remote" && job.remoteScope === "worldwide") ||
        job.remoteRegions.some((r) => hasWord(r, region) || hasWord(region, r)) ||
        hasWord(job.location, region);
      if (!open) return false;
    }
    if (words.length) {
      const haystack = [job.title, job.summary, labelFor(ROLE_LABELS, job.role), ...job.skills].join(" \n ");
      if (!words.every((w) => hasWord(haystack, w, true))) return false;
    }
    return true;
  });
}

const withRef = (url: string) => `${url}?ref=${MCP_REF}`;

function warningLine(job: ApiJob): string | null {
  if (!job.scam.warning) return null;
  return `- **${job.scam.warning}** (scam score ${job.scam.score}). Read the reasons with get_job before applying.`;
}

function postedLine(job: ApiJob, now: number): string {
  const when = job.postedAt ? ` ${dayKey(job.postedAt, "UTC")} (${relativeTime(job.postedAt, now)})` : "";
  return `- ID ${job.id}, posted${when} in r/${job.subreddit}`;
}

function factsLine(job: ApiJob): string {
  const facts = [job.pay.text, labelFor(EMPLOYMENT_LABELS, job.employmentType), labelFor(SENIORITY_LABELS, job.seniority), job.where];
  return `- ${facts.filter(Boolean).join(" · ")}`;
}

/** One job in a list of results: everything needed to judge it, and both links. */
function jobBlock(job: ApiJob, now: number): string[] {
  const lines = [`### ${job.title}`];
  const warning = warningLine(job);
  if (warning) lines.push(warning);
  lines.push(postedLine(job, now), factsLine(job));
  if (job.skills.length) lines.push(`- Skills: ${job.skills.slice(0, 8).join(", ")}`);
  lines.push(`- ${SITE_NAME}: ${withRef(job.url)}`, `- Apply on Reddit: ${job.redditUrl}`, "", job.summary, "");
  return lines;
}

function snapshotLine(list: ApiJobList): string {
  return list.syncedAt ? `Jobs as of ${dayKey(list.syncedAt, "UTC")} ${list.syncedAt.slice(11, 16)} UTC.` : "";
}

export function renderSearch(list: ApiJobList, matches: ApiJob[], input: SearchInput, now: number): string {
  const shown = matches.slice(0, input.limit);
  const head =
    matches.length === 0
      ? `No jobs match. Try fewer filters, a longer posted_within_days (up to ${LIST_WINDOW_DAYS}), or other words.`
      : `${countLabel(matches.length, "job")} match${matches.length === 1 ? "es" : ""}` +
        (shown.length < matches.length ? `; showing the newest ${shown.length}.` : ", newest first.");
  return [head, snapshotLine(list), "", ...shown.flatMap((job) => jobBlock(job, now))].join("\n").trim();
}

export function renderJob(job: ApiJobDetail, now: number): string {
  const lines = [`# ${job.title}`, ""];
  if (job.scam.warning) {
    lines.push(`**${job.scam.warning}**: scam score ${job.scam.score} out of 1. Warn the user before they apply.`, "");
  }
  lines.push(postedLine(job, now), factsLine(job));
  if (job.pay.type) lines.push(`- Pay type: ${labelFor(PAY_TYPE_LABELS, job.pay.type)}`);
  if (job.role) lines.push(`- Role: ${labelFor(ROLE_LABELS, job.role)}`);
  if (job.skills.length) lines.push(`- Skills: ${job.skills.join(", ")}`);
  if (job.languages.length) {
    const langs = job.languages.map((l) => (l.level ? `${LANGUAGE_LEVEL_LABELS[l.level]} ${l.language}` : l.language));
    lines.push(`- Languages: ${langs.join(", ")}`);
  }
  if (job.testTask) lines.push(`- ${TEST_TASK_LABELS[job.testTask]}${job.testTaskDetails ? `: ${job.testTaskDetails}` : ""}`);
  if (job.expired) lines.push(`- Posted more than ${EXPIRY_DAYS} days ago, so it may be filled.`);
  lines.push(`- How to apply: ${job.howToApply ?? "see the post"}`);
  if (job.author) lines.push(`- Posted by u/${job.author}`);
  lines.push(`- ${SITE_NAME}: ${withRef(job.url)}`, `- Apply on Reddit: ${job.redditUrl}`, "", "## Summary", "", job.summary, "");

  lines.push("## Scam check", "");
  lines.push(job.scam.score == null ? "Not scored." : `Scam score ${job.scam.score} (0 is clean, 1 is certainly a scam).`);
  if (job.scam.redFlags.length) lines.push("", "Red flags the grader found:", ...job.scam.redFlags.map((f) => `- ${f}`));
  else lines.push("The grader found no red flags.");
  lines.push("");

  if (job.bodyExcerpt) {
    lines.push("## Opening of the post", "", job.bodyExcerpt, "", `${SITE_NAME} keeps only the opening lines. The full post is on Reddit.`);
  }
  return lines.join("\n").trim();
}

export function renderSubreddits(list: ApiJobList, base: URL): string {
  const open = (name: string) =>
    list.jobs.filter((j) => j.subreddit.toLowerCase() === name.toLowerCase() && !j.expired && !j.adult && j.scam.warning !== "Likely scam").length;
  const subs = SUBREDDITS.map((s) => ({ ...s, open: open(s.name) })).sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  return [
    `${SITE_NAME} reads ${countLabel(subs.length, "subreddit")}. Open jobs are those posted in the last ${EXPIRY_DAYS} days, likely scams left out.`,
    snapshotLine(list),
    "",
    ...subs.map((s) => `- r/${s.name}: ${countLabel(s.open, "open job")}. ${s.blurb} ${withRef(new URL(subredditPath(s.name), base).toString())}`),
  ]
    .join("\n")
    .trim();
}

/** The Reddit post ID in an ID, a Reddit link or a link to a job page on this site. Null if there's none. */
export function jobIdFrom(input: string): string | null {
  const s = input.trim();
  if (/^[a-z0-9]{3,12}$/i.test(s)) return s.toLowerCase();
  const match = s.match(/(?:\/jobs\/|\/comments\/|redd\.it\/|^t3_)([a-z0-9]{3,12})(?![a-z0-9])/i);
  return match ? match[1].toLowerCase() : null;
}
