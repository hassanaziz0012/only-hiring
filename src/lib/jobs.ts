// The job row type, defensive parsing, and the expiry and scam rules.
// Safe to import from client components: no database access here.

import { EXPIRY_DAYS, SCAM_HIDE_THRESHOLD, SCAM_WARN_THRESHOLD } from "./site";

/** A row of the `jobs` table as returned by the driver, before parsing. Mirrors db/schema.sql in the pipeline repo. */
export type JobRow = {
  id: unknown;
  subreddit: unknown;
  reddit_url: unknown;
  reddit_title: unknown;
  author: unknown;
  flair: unknown;
  body_excerpt: unknown;
  posted_at: unknown;
  job_title: unknown;
  summary: unknown;
  role_category: unknown;
  seniority: unknown;
  employment_type: unknown;
  pay_type: unknown;
  pay_min: unknown;
  pay_max: unknown;
  pay_currency: unknown;
  pay_raw: unknown;
  work_mode: unknown;
  location: unknown;
  skills: unknown;
  apply_method: unknown;
  scam_score: unknown;
  red_flags: unknown;
};

/** A parsed job, serializable so it can cross the server/client boundary. */
export type Job = {
  id: string;
  subreddit: string;
  redditUrl: string;
  redditTitle: string;
  author: string | null;
  flair: string | null;
  /** The opening of the post body as plain text, cut to a few hundred characters by the pipeline. */
  bodyExcerpt: string | null;
  /** ISO timestamp, or null when the post time is unknown. */
  postedAt: string | null;
  jobTitle: string;
  summary: string;
  roleCategory: string | null;
  seniority: string | null;
  employmentType: string | null;
  payType: string | null;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string | null;
  payRaw: string | null;
  workMode: string | null;
  location: string | null;
  skills: string[];
  applyMethod: string | null;
  /** 0–1, higher is more likely a scam. Null means not scored, treated as not flagged. */
  scamScore: number | null;
  redFlags: string[];
};

export const JOB_COLUMNS = [
  "id",
  "subreddit",
  "reddit_url",
  "reddit_title",
  "author",
  "flair",
  "body_excerpt",
  "posted_at",
  "job_title",
  "summary",
  "role_category",
  "seniority",
  "employment_type",
  "pay_type",
  "pay_min",
  "pay_max",
  "pay_currency",
  "pay_raw",
  "work_mode",
  "location",
  "skills",
  "apply_method",
  "scam_score",
  "red_flags",
] as const;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((v): v is string => v !== null);
}

function isoDate(value: unknown): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Only allow http(s) links to Reddit; anything else falls back to the canonical post URL. */
function safeRedditUrl(value: unknown, id: string): string {
  const raw = text(value);
  if (raw) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      if ((url.protocol === "https:" || url.protocol === "http:") && (host === "reddit.com" || host.endsWith(".reddit.com") || host === "redd.it")) {
        url.protocol = "https:";
        return url.toString();
      }
    } catch {
      // fall through
    }
  }
  return `https://www.reddit.com/comments/${encodeURIComponent(id)}`;
}

/** Parse a raw row. Returns null for a row missing its ID, so one bad row can't break the page. */
export function parseJobRow(row: JobRow): Job | null {
  const id = text(row.id);
  if (!id) return null;
  const redditTitle = text(row.reddit_title) ?? "Untitled post";
  let payMin = num(row.pay_min);
  let payMax = num(row.pay_max);
  if (payMin != null && payMax != null && payMin > payMax) [payMin, payMax] = [payMax, payMin];
  const score = num(row.scam_score);

  return {
    id,
    subreddit: (text(row.subreddit) ?? "unknown").replace(/^\/?r\//i, ""),
    redditUrl: safeRedditUrl(row.reddit_url, id),
    redditTitle,
    author: text(row.author),
    flair: text(row.flair),
    bodyExcerpt: text(row.body_excerpt),
    postedAt: isoDate(row.posted_at),
    jobTitle: text(row.job_title) ?? redditTitle,
    summary: text(row.summary) ?? "",
    roleCategory: text(row.role_category),
    seniority: text(row.seniority),
    employmentType: text(row.employment_type),
    payType: text(row.pay_type),
    payMin,
    payMax,
    payCurrency: text(row.pay_currency)?.toUpperCase() ?? null,
    payRaw: text(row.pay_raw),
    workMode: text(row.work_mode),
    location: text(row.location),
    skills: textArray(row.skills),
    applyMethod: text(row.apply_method),
    scamScore: score == null ? null : Math.min(1, Math.max(0, score)),
    redFlags: textArray(row.red_flags),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Older than the expiry window, or with no post time at all. */
export function isExpired(job: Job, now: number): boolean {
  if (!job.postedAt) return true;
  return now - Date.parse(job.postedAt) > EXPIRY_DAYS * DAY_MS;
}

/** Hidden from the main list by default. */
export function isLikelyScam(job: Job): boolean {
  return job.scamScore != null && job.scamScore >= SCAM_HIDE_THRESHOLD;
}

const NSFW = /\b(nsfw|hentai|porn)/i;

/** Adult content, judged from the titles and summary. The pipeline has no NSFW flag. */
export function isNsfw(job: Job): boolean {
  return NSFW.test(job.jobTitle) || NSFW.test(job.redditTitle) || NSFW.test(job.summary);
}

const THIN_WORDS = 50;

const wordCount = (s: string | null) => (s ? s.split(/\s+/).filter(Boolean).length : 0);

/**
 * Too little on the page to be worth a search result: crossposts and link posts with no body, where
 * the details are only on Reddit, or a summary and excerpt that together run under THIN_WORDS words.
 */
export function isThin(job: Job): boolean {
  return !job.bodyExcerpt || wordCount(job.summary) + wordCount(job.bodyExcerpt) < THIN_WORDS;
}

/** Search engines get only the jobs the board lists by default, minus adult content and thin pages. */
export function isIndexable(job: Job, now: number): boolean {
  return !isExpired(job, now) && !isLikelyScam(job) && !isNsfw(job) && !isThin(job);
}

/** Shows a warning chip, even when visible. */
export function hasScamWarning(job: Job): boolean {
  return job.scamScore != null && job.scamScore >= SCAM_WARN_THRESHOLD;
}

export function scamWarningLabel(job: Job): string | null {
  if (isLikelyScam(job)) return "Likely scam";
  if (hasScamWarning(job)) return "Possible scam";
  return null;
}
