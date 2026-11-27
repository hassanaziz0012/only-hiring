import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJobRow, type Job, type JobRow } from "./jobs";
import { jobPageTitles } from "./page-title";
import { LIST_WINDOW_DAYS } from "./site";
import { buildSiteStats, jobStats, type SiteStats } from "./stats";
import { parseStatsRow, type StatsRow, type SubredditStats } from "./subreddits";

// The site's data is two JSON files the pipeline writes (its export_site_data.py), and every deploy is built from
// them: new data goes live with a deploy (scripts/deploy.mjs), not by clearing a cache. The files are gitignored,
// since posts and usernames removed from Reddit would stay in a public repo's history.
//
// The whole site is a static export (output: "export" in next.config.ts), so every page, feed and JSON file is
// built from them once per deploy. Anything that depends on the clock, like "expired", is as of the build.

const DAY_S = 24 * 60 * 60;

type Data = {
  /** Every job, newest first. */
  jobs: Job[];
  byId: Map<string, Job>;
  /** Jobs posted in the LIST_WINDOW_DAYS days before the last export, with only the fields the lists show. */
  listed: Job[];
  titles: Map<string, string>;
  subs: SubredditStats[];
  /** When the pipeline wrote the files (ISO), or null if unknown. */
  syncedAt: string | null;
  firstSyncedAt: string | null;
  statsChangedAt: string | null;
};

function isoDate(value: unknown): string | null {
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

const dates = (values: unknown[]) => values.map(isoDate).filter((d): d is string => d !== null).sort();

const byNewest = (a: Job, b: Job) =>
  (b.postedAt ?? "").localeCompare(a.postedAt ?? "") || (a.id < b.id ? -1 : 1);

/** The fields only a job page shows are left out of the lists, which go to the browser (/api/board). */
const forList = (job: Job): Job => ({
  ...job,
  author: null,
  bodyExcerpt: null,
  testTaskDetails: null,
  applyMethod: null,
  redFlags: [],
});

function readData(): Data {
  const jobsFile = JSON.parse(readFileSync(join(process.cwd(), "data", "jobs.json"), "utf8"));
  const statsFile = JSON.parse(readFileSync(join(process.cwd(), "data", "subreddit-stats.json"), "utf8"));
  const rows = jobsFile.jobs as (JobRow & { first_synced_at?: unknown })[];
  const statsRows = statsFile.subreddits as StatsRow[];

  const syncedAt = isoDate(jobsFile.synced_at);
  const jobs = rows.map(parseJobRow).filter((j): j is Job => j !== null).sort(byNewest);
  const oldest = syncedAt ? Date.parse(syncedAt) - LIST_WINDOW_DAYS * DAY_S * 1000 : 0;
  const listed = jobs.filter((job) => job.postedAt && Date.parse(job.postedAt) >= oldest).map(forList);

  return {
    jobs,
    byId: new Map(jobs.map((job) => [job.id, job])),
    listed,
    titles: jobPageTitles(listed),
    subs: statsRows.map(parseStatsRow).filter((s): s is SubredditStats => s !== null),
    syncedAt,
    firstSyncedAt: dates(rows.map((r) => r.first_synced_at))[0] ?? null,
    statsChangedAt: dates(statsRows.map((r) => r.changed_at)).at(-1) ?? null,
  };
}

let loaded: Data | null = null;

/** The data files, read once per server process. Null if they aren't there (a fresh clone of the repo). */
function data(): Data | null {
  // In development, read them again each time, so an export shows up after a hard reload.
  if (loaded && process.env.NODE_ENV === "production") return loaded;
  try {
    return (loaded = readData());
  } catch (error) {
    // Never publish a site without its jobs. A Git-triggered build has no data files, so it fails here.
    if (process.env.NODE_ENV === "production") throw new Error("data/*.json can't be read. Run `onlyhiring export` first, then `npm run deploy`.", { cause: error });
    console.error("[data] could not read data/*.json:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export type JobsResult =
  | {
      ok: true;
      jobs: Job[];
      /** The time this was built (ISO), which "expired" is worked out from. */
      fetchedAt: string;
      /** When the pipeline last updated the jobs (ISO), or null if unknown. */
      syncedAt: string | null;
    }
  | { ok: false; fetchedAt: string };

/** The jobs posted in the last LIST_WINDOW_DAYS days, newest first. Older jobs are still served by getJob. */
export async function getJobs(): Promise<JobsResult> {
  const fetchedAt = new Date().toISOString();
  const d = data();
  return d ? { ok: true, jobs: d.listed, fetchedAt, syncedAt: d.syncedAt } : { ok: false, fetchedAt };
}

/** One job by ID, whatever its age, or null if there is none. */
export async function getJob(id: string): Promise<{ ok: true; job: Job | null; fetchedAt: string } | { ok: false }> {
  const now = Date.now();
  const d = data();
  const job = d?.byId.get(id) ?? null;
  return d ? { ok: true, job, fetchedAt: new Date(now).toISOString() } : { ok: false };
}

/** Every job's ID, whatever its age: the job pages, their images and /api/jobs/<id> are all built for each. */
export function getAllJobIds(): string[] {
  return data()?.jobs.map((job) => job.id) ?? [];
}

/** The <title> of one job's page, or null if the job isn't listed. A title two jobs share gets each post's date. */
export function getJobTitle(id: string): string | null {
  return data()?.titles.get(id) ?? null;
}

export type StatsResult =
  | {
      ok: true;
      /** One row per subreddit the pipeline has graded posts from. */
      subs: SubredditStats[];
      /** When any subreddit's figures last changed (ISO), or null if there are none. */
      changedAt: string | null;
    }
  | { ok: false };

/** The per-subreddit figures behind the guides and subreddit pages (see lib/subreddits.ts). */
export async function getSubredditStats(): Promise<StatsResult> {
  const d = data();
  return d ? { ok: true, subs: d.subs, changedAt: d.statsChangedAt } : { ok: false };
}

/** Everything on the stats page. Null if there's no data. */
export async function getSiteStats(): Promise<SiteStats | null> {
  const d = data();
  return d
    ? buildSiteStats({
        subs: d.subs,
        changedAt: d.statsChangedAt,
        firstSyncedAt: d.firstSyncedAt,
        syncedAt: d.syncedAt,
        ...jobStats(d.jobs),
      })
    : null;
}
