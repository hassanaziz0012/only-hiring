import "server-only";

import { neon } from "@neondatabase/serverless";
import { cacheLife, cacheTag } from "next/cache";
import { JOB_COLUMNS, parseJobRow, type Job, type JobRow } from "./jobs";
import { jobPageTitles } from "./page-title";
import { LIST_WINDOW_DAYS } from "./site";
import { buildSiteStats, TOP_LANGUAGES, TOP_REGIONS, TOP_SKILLS, type FacetRow, type SiteStats } from "./stats";
import { parseStatsRow, type StatsRow, type SubredditStats } from "./subreddits";

export const JOBS_CACHE_TAG = "jobs";

// Data only changes when the pipeline syncs, and refresh.sh clears JOBS_CACHE_TAG after each sync, so the
// timer is a backstop. It also re-renders "expired" status, which is worked out from the fetch time.
const CACHE_LIFE = { stale: 300, revalidate: 86400, expire: 604800 };

export type JobsResult =
  | {
      ok: true;
      jobs: Job[];
      /** When this snapshot was read from the database (ISO). */
      fetchedAt: string;
      /** Most recent pipeline sync (ISO), or null if unknown. */
      syncedAt: string | null;
    }
  | { ok: false; fetchedAt: string };

/** Strip anything that looks like a connection string before an error reaches the logs. */
function redact(message: string): string {
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]");
}

// Neon's HTTP endpoint ignores Accept-Encoding, so every byte a query returns is billed as transfer.
// The list views never show these columns, and body_excerpt is the largest field. The excerpt's word
// count stands in for it, which is all isThin needs.
const LIST_OMITTED = new Set<string>(["author", "body_excerpt", "test_task_details", "apply_method", "red_flags"]);
const LIST_SELECT = [
  ...JOB_COLUMNS.filter((c) => !LIST_OMITTED.has(c)),
  "(SELECT count(*) FROM regexp_matches(body_excerpt, '\\S+', 'g'))::int AS body_words",
];
const LIST_KEYS = LIST_SELECT.map((c) => c.split(" AS ").at(-1)!);

// What a job page's <title> is built from: see lib/page-title.ts. The post's own title stands in where the
// grader found no job title, as parseJobRow does.
const TITLE_SELECT = [
  "id",
  "subreddit",
  "posted_at",
  "coalesce(nullif(btrim(job_title), ''), reddit_title) AS job_title",
  "pay_type",
  "pay_min",
  "pay_max",
  "pay_currency",
  "pay_raw",
  "work_mode",
];
const TITLE_KEYS = TITLE_SELECT.map((c) => c.split(" AS ").at(-1)!);

/**
 * Rows as positional arrays (arrayMode) drop the repeated column names, about 27% off the payload.
 * This puts the names back.
 */
async function selectRows(url: string, select: string[], keys: string[], tail: string, params: unknown[] = []): Promise<JobRow[]> {
  const rows = (await neon(url).query(`SELECT ${select.join(", ")} ${tail}`, params, { arrayMode: true })) as unknown[][];
  return rows.map((row) => Object.fromEntries(keys.map((key, i) => [key, row[i]])) as JobRow);
}

const RECENT = `FROM jobs WHERE posted_at >= now() - make_interval(days => $1)`;

/**
 * The jobs posted in the last LIST_WINDOW_DAYS days, newest first, without the columns only a job page
 * shows. Read-only: the web_reader role can only SELECT. Older jobs are still served by getJob.
 *
 * Cached for a day, or until /api/revalidate clears the JOBS_CACHE_TAG after a sync. Read-only: the web_reader role can only SELECT.
 * A failed read is cached for only a minute, so the site recovers soon after the database comes back.
 */
export async function getJobs(): Promise<JobsResult> {
  "use cache";
  cacheTag(JOBS_CACHE_TAG);
  const fetchedAt = new Date().toISOString();

  try {
    const url = process.env.WEB_DATABASE_URL;
    if (!url) throw new Error("WEB_DATABASE_URL is not set");
    const sql = neon(url);

    const [rows, meta] = await Promise.all([
      selectRows(url, LIST_SELECT, LIST_KEYS, `${RECENT} ORDER BY posted_at DESC, id LIMIT 5000`, [LIST_WINDOW_DAYS]),
      sql.query("SELECT max(last_synced_at) AS synced_at FROM jobs"),
    ]);

    const jobs = rows.map(parseJobRow).filter((j): j is Job => j !== null);
    const syncedRaw = (meta as { synced_at: unknown }[])[0]?.synced_at;
    const synced = syncedRaw == null ? null : new Date(String(syncedRaw instanceof Date ? syncedRaw.toISOString() : syncedRaw));

    cacheLife(CACHE_LIFE);
    return {
      ok: true,
      jobs,
      fetchedAt,
      syncedAt: synced && !Number.isNaN(synced.getTime()) ? synced.toISOString() : null,
    };
  } catch (error) {
    console.error("[db] could not load jobs:", redact(error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"));
    cacheLife({ stale: 60, revalidate: 60, expire: 600 });
    return { ok: false, fetchedAt };
  }
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

/**
 * The per-subreddit figures behind the guides and subreddit pages (see lib/subreddits.ts). Cached and
 * revalidated with the job list, so the refresh after each sync updates both.
 */
export async function getSubredditStats(): Promise<StatsResult> {
  "use cache";
  cacheTag(JOBS_CACHE_TAG);

  try {
    const url = process.env.WEB_DATABASE_URL;
    if (!url) throw new Error("WEB_DATABASE_URL is not set");
    const rows = (await neon(url).query("SELECT * FROM subreddit_stats")) as StatsRow[];
    const subs = rows.map(parseStatsRow).filter((s): s is SubredditStats => s !== null);
    const stamps = rows.map((r) =>
      r.changed_at == null ? NaN : new Date(r.changed_at instanceof Date ? r.changed_at : String(r.changed_at)).getTime(),
    );
    const newest = Math.max(...stamps.filter(Number.isFinite));
    cacheLife(CACHE_LIFE);
    return { ok: true, subs, changedAt: Number.isFinite(newest) ? new Date(newest).toISOString() : null };
  } catch (error) {
    console.error("[db] could not load subreddit stats:", redact(error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"));
    cacheLife({ stale: 60, revalidate: 60, expire: 600 });
    return { ok: false };
  }
}

const iso = (v: unknown) => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// Each language a job requires, guarded so one malformed row can't fail the query.
const LANGUAGES_OF = "jsonb_array_elements(CASE WHEN jsonb_typeof(language_requirements) = 'array' THEN language_requirements ELSE '[]'::jsonb END)";

// Every breakdown of the jobs table in one round trip, as (facet, value, jobs) rows. Counting in the database
// keeps the transfer to a few KB however many jobs there are; see the note above LIST_OMITTED.
const FACETS_SQL = `
  SELECT 'role' AS facet, coalesce(role_category, '') AS key, count(*)::int AS n FROM jobs GROUP BY 2
  UNION ALL
  SELECT 'mode', CASE WHEN work_mode = 'remote' THEN 'remote_' || coalesce(remote_scope, 'unstated') ELSE coalesce(work_mode, '') END,
    count(*)::int FROM jobs GROUP BY 2
  UNION ALL
  SELECT 'employment', coalesce(employment_type, ''), count(*)::int FROM jobs GROUP BY 2
  UNION ALL
  SELECT 'seniority', coalesce(seniority, ''), count(*)::int FROM jobs GROUP BY 2
  UNION ALL
  SELECT 'test', coalesce(test_task, ''), count(*)::int FROM jobs GROUP BY 2
  UNION ALL
  (SELECT 'region', btrim(r), count(DISTINCT id)::int FROM jobs, unnest(remote_regions) r
    WHERE work_mode = 'remote' AND remote_scope = 'restricted' AND btrim(r) <> '' GROUP BY 2 ORDER BY 3 DESC, 2 LIMIT ${TOP_REGIONS})
  UNION ALL
  (SELECT 'language', btrim(l->>'language'), count(DISTINCT id)::int FROM jobs, ${LANGUAGES_OF} l
    WHERE btrim(l->>'language') <> '' GROUP BY 2 ORDER BY 3 DESC, 2 LIMIT ${TOP_LANGUAGES})
  UNION ALL
  -- Skills are free text, so they're grouped case-insensitively under their most common spelling. Languages
  -- show up as skills too ("English"); they have their own breakdown, so they're left out here.
  (SELECT 'skill', mode() WITHIN GROUP (ORDER BY btrim(s)), count(DISTINCT id)::int FROM jobs, unnest(skills) s
    WHERE btrim(s) <> '' AND lower(btrim(s)) NOT IN (
      SELECT lower(btrim(l->>'language')) FROM jobs, ${LANGUAGES_OF} l WHERE l->>'language' IS NOT NULL
    )
    GROUP BY lower(btrim(s)) ORDER BY 3 DESC, 2 LIMIT ${TOP_SKILLS})`;

const JOB_TOTALS_SQL = `
  SELECT count(*)::int AS listed,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ${LANGUAGES_OF} l WHERE btrim(l->>'language') <> ''))::int AS with_language,
    count(*) FILTER (WHERE pay_min IS NOT NULL OR pay_max IS NOT NULL)::int AS with_pay,
    count(*) FILTER (WHERE test_task IS NOT NULL)::int AS with_test,
    count(*) FILTER (WHERE work_mode = 'remote' AND remote_scope = 'restricted')::int AS restricted_remote,
    min(first_synced_at) AS first_synced_at,
    max(last_synced_at) AS synced_at
  FROM jobs`;

// The midpoint of each stated range, as site_stats.py takes it for the per-subreddit medians.
const MEDIANS_SQL = `
  SELECT pay_type, count(*)::int AS n,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY (coalesce(pay_min, pay_max) + coalesce(pay_max, pay_min)) / 2))::float8 AS median
  FROM jobs
  WHERE upper(pay_currency) = 'USD' AND (pay_min IS NOT NULL OR pay_max IS NOT NULL) AND pay_type IS NOT NULL
  GROUP BY 1`;

const STATS_TOTALS_SQL = `
  SELECT ${["graded", "hiring", "discussion", "for_hire", "spam", "unpaid", "other", "prefiltered", "clean", "warned", "likely",
    "flag_vague", "flag_low_pay", "flag_free_work", "flag_high_pay", "flag_money"].map((c) => `coalesce(sum(${c}), 0)::int AS ${c}`).join(", ")},
    coalesce(sum(removed_warned + removed_unwarned), 0)::int AS removed,
    max(changed_at) AS changed_at
  FROM subreddit_stats`;

/**
 * Everything on the stats page, counted in the database. Cached and revalidated with the job list, so the
 * refresh after each sync updates it. Null if the database can't be read.
 */
export async function getSiteStats(): Promise<SiteStats | null> {
  "use cache";
  cacheTag(JOBS_CACHE_TAG);

  try {
    const url = process.env.WEB_DATABASE_URL;
    if (!url) throw new Error("WEB_DATABASE_URL is not set");
    const sql = neon(url);
    const [totals, subs, facets, jobs, medians] = (await Promise.all([
      sql.query(STATS_TOTALS_SQL),
      sql.query("SELECT subreddit, hiring::int AS hiring FROM subreddit_stats WHERE graded > 0"),
      sql.query(FACETS_SQL),
      sql.query(JOB_TOTALS_SQL),
      sql.query(MEDIANS_SQL),
    ])) as Record<string, unknown>[][];

    const { changed_at, ...sums } = totals[0] ?? {};
    const job = jobs[0] ?? {};
    const stats = buildSiteStats({
      totals: Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, Number(v) || 0])),
      changedAt: iso(changed_at),
      subs: subs.map((r) => ({ subreddit: String(r.subreddit), hiring: Number(r.hiring) || 0 })),
      facets: facets.map((r) => ({ facet: String(r.facet), key: String(r.key ?? ""), n: Number(r.n) || 0 }) satisfies FacetRow),
      jobs: {
        listed: Number(job.listed) || 0,
        withLanguage: Number(job.with_language) || 0,
        withPay: Number(job.with_pay) || 0,
        withTest: Number(job.with_test) || 0,
        restrictedRemote: Number(job.restricted_remote) || 0,
      },
      firstSyncedAt: iso(job.first_synced_at),
      syncedAt: iso(job.synced_at),
      medians: medians.flatMap((r) =>
        r.median == null ? [] : [{ payType: String(r.pay_type), n: Number(r.n) || 0, median: Number(r.median) }],
      ),
    });
    cacheLife(CACHE_LIFE);
    return stats;
  } catch (error) {
    console.error("[db] could not load site stats:", redact(error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"));
    cacheLife({ stale: 60, revalidate: 60, expire: 600 });
    return null;
  }
}

/** One job by ID, whatever its age, or null if there is none. Reads a single row. */
export async function getJob(id: string): Promise<{ ok: true; job: Job | null; fetchedAt: string } | { ok: false }> {
  "use cache";
  cacheTag(JOBS_CACHE_TAG);
  const fetchedAt = new Date().toISOString();

  try {
    const url = process.env.WEB_DATABASE_URL;
    if (!url) throw new Error("WEB_DATABASE_URL is not set");
    const rows = (await neon(url).query(`SELECT ${JOB_COLUMNS.join(", ")} FROM jobs WHERE id = $1`, [id])) as JobRow[];
    cacheLife(CACHE_LIFE);
    return { ok: true, job: rows[0] ? parseJobRow(rows[0]) : null, fetchedAt };
  } catch (error) {
    console.error("[db] could not load job:", redact(error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"));
    cacheLife({ stale: 60, revalidate: 60, expire: 600 });
    return { ok: false };
  }
}

/**
 * The <title> of every job page in the list window, by job ID. A title two jobs share gets each post's date,
 * so the whole window is needed, but only the handful of columns the title uses. Returns the finished
 * titles, so the cache holds a small object rather than rows.
 */
export async function getJobTitles(): Promise<Record<string, string>> {
  "use cache";
  cacheTag(JOBS_CACHE_TAG);

  try {
    const url = process.env.WEB_DATABASE_URL;
    if (!url) throw new Error("WEB_DATABASE_URL is not set");
    const rows = await selectRows(url, TITLE_SELECT, TITLE_KEYS, `${RECENT} ORDER BY posted_at DESC, id LIMIT 5000`, [LIST_WINDOW_DAYS]);
    cacheLife(CACHE_LIFE);
    return Object.fromEntries(jobPageTitles(rows.map(parseJobRow).filter((j): j is Job => j !== null)));
  } catch (error) {
    console.error("[db] could not load job titles:", redact(error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"));
    cacheLife({ stale: 60, revalidate: 60, expire: 600 });
    return {};
  }
}

/**
 * Jobs first added by the most recent pipeline sync. Every sync stamps last_synced_at on all rows,
 * so the newest stamp marks the sync, and rows first seen within a few minutes of it are new.
 * Uncached: called right after a sync, from /api/revalidate.
 */
export async function getNewlySyncedJobs(): Promise<Job[]> {
  const url = process.env.WEB_DATABASE_URL;
  if (!url) throw new Error("WEB_DATABASE_URL is not set");
  const rows = await selectRows(
    url,
    LIST_SELECT,
    LIST_KEYS,
    "FROM jobs WHERE first_synced_at >= (SELECT max(last_synced_at) FROM jobs) - interval '15 minutes'",
  );
  return rows.map(parseJobRow).filter((j): j is Job => j !== null);
}
