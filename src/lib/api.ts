// The public JSON shapes served by /api/jobs and /api/jobs/[id], which the MCP server (worker/mcp.ts) reads too.
// Pure functions: they never read the data files. Enum-like fields keep the pipeline's raw keys (see lib/labels.ts), so
// clients can filter on them; `pay.text` and `where` are the site's own display strings.

import { formatPay, locationText, workModeText } from "./format";
import { isExpired, isNsfw, scamWarningLabel, type Job, type LanguageRequirement, type TestTaskPay } from "./jobs";
import { APPLY_METHOD_LABELS, labelFor } from "./labels";

export const API_JOBS_PATH = "/api/jobs";
/** The file behind API_JOBS_PATH. It can't be built at /api/jobs, which is also the folder of the per-job files, so
 * out/_redirects rewrites API_JOBS_PATH to it (scripts/cloudflare-assets.mjs). */
export const API_JOBS_FILE = "/api/jobs.json";
export const apiJobPath = (id: string) => `${API_JOBS_PATH}/${encodeURIComponent(id)}`;

/**
 * /api/jobs/<id> isn't a file per job: Cloudflare allows 20,000 files per deploy on the free plan, and a file per
 * job would use them up within months. The build writes every job's detail into one of JOB_SHARDS files
 * (src/app/api/job-shards), and the Worker answers /api/jobs/<id> from the right one (worker/index.ts).
 */
export const JOB_SHARDS = 64;

/** Which shard file a job's detail is in. */
export function jobShard(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % JOB_SHARDS;
}

export const jobShardPath = (shard: number) => `/api/job-shards/${shard}`;

/** One shard file: the details of every job whose ID hashes to it, by ID. */
export type ApiJobShard = Record<string, ApiJobDetail>;

export type ApiJob = {
  id: string;
  /** The job's page on this site. */
  url: string;
  /** The original post, where applications happen. */
  redditUrl: string;
  title: string;
  subreddit: string;
  postedAt: string | null;
  /** Posted longer ago than the board's expiry window. */
  expired: boolean;
  summary: string;
  role: string | null;
  seniority: string | null;
  employmentType: string | null;
  pay: { text: string; type: string | null; min: number | null; max: number | null; currency: string | null };
  workMode: string | null;
  /** "Remote (worldwide)", "Remote (US, Canada)", "Hybrid, Berlin"… Null when the post doesn't say. */
  where: string | null;
  remoteScope: "worldwide" | "restricted" | null;
  remoteRegions: string[];
  location: string | null;
  languages: LanguageRequirement[];
  testTask: TestTaskPay | null;
  skills: string[];
  /** score is 0–1, null when not scored. warning is "Possible scam", "Likely scam" or null. */
  scam: { score: number | null; warning: string | null };
  /** Adult content, judged from the titles and summary. */
  adult: boolean;
};

/** A job page's extra fields: the post's opening lines, the scam score's reasons and how to apply. */
export type ApiJobDetail = ApiJob & {
  author: string | null;
  bodyExcerpt: string | null;
  testTaskDetails: string | null;
  howToApply: string | null;
  scam: ApiJob["scam"] & { redFlags: string[] };
};

export type ApiJobList = {
  /** When this list was built (ISO). */
  fetchedAt: string;
  /** When the pipeline last updated the jobs (ISO), or null if unknown. */
  syncedAt: string | null;
  /** Every job posted within the list window, newest first, likely scams included. */
  jobs: ApiJob[];
};

export function toApiJob(job: Job, now: number, base: URL): ApiJob {
  const where = [workModeText(job), locationText(job)].filter(Boolean).join(", ");
  return {
    id: job.id,
    url: new URL(`/jobs/${job.id}`, base).toString(),
    redditUrl: job.redditUrl,
    title: job.jobTitle,
    subreddit: job.subreddit,
    postedAt: job.postedAt,
    expired: isExpired(job, now),
    summary: job.summary,
    role: job.roleCategory,
    seniority: job.seniority,
    employmentType: job.employmentType,
    pay: { text: formatPay(job).text, type: job.payType, min: job.payMin, max: job.payMax, currency: job.payCurrency },
    workMode: job.workMode,
    where: where || null,
    remoteScope: job.remoteScope,
    remoteRegions: job.remoteRegions,
    location: job.location,
    languages: job.languages,
    testTask: job.testTask,
    skills: job.skills,
    scam: { score: job.scamScore, warning: scamWarningLabel(job) },
    adult: isNsfw(job),
  };
}

export function toApiJobDetail(job: Job, now: number, base: URL): ApiJobDetail {
  const summary = toApiJob(job, now, base);
  return {
    ...summary,
    author: job.author,
    bodyExcerpt: job.bodyExcerpt,
    testTaskDetails: job.testTaskDetails,
    howToApply: labelFor(APPLY_METHOD_LABELS, job.applyMethod),
    scam: { ...summary.scam, redFlags: job.redFlags },
  };
}
