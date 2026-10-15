import "server-only";

import { neon } from "@neondatabase/serverless";
import { cacheLife, cacheTag } from "next/cache";
import { JOB_COLUMNS, parseJobRow, type Job, type JobRow } from "./jobs";

export const JOBS_CACHE_TAG = "jobs";

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

/**
 * Every job in the table, newest first. Read-only: the web_reader role can only SELECT.
 *
 * Cached for 2 hours, or until /api/revalidate clears the JOBS_CACHE_TAG. A failed read is cached
 * for only a minute, so the site recovers soon after the database comes back.
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
      sql.query(`SELECT ${JOB_COLUMNS.join(", ")} FROM jobs ORDER BY posted_at DESC NULLS LAST, id LIMIT 5000`),
      sql.query("SELECT max(last_synced_at) AS synced_at FROM jobs"),
    ]);

    const jobs = (rows as JobRow[]).map(parseJobRow).filter((j): j is Job => j !== null);
    const syncedRaw = (meta as { synced_at: unknown }[])[0]?.synced_at;
    const synced = syncedRaw == null ? null : new Date(String(syncedRaw instanceof Date ? syncedRaw.toISOString() : syncedRaw));

    cacheLife({ stale: 300, revalidate: 7200, expire: 86400 });
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

export async function getJob(id: string): Promise<{ ok: true; job: Job | null; fetchedAt: string } | { ok: false }> {
  const result = await getJobs();
  if (!result.ok) return { ok: false };
  return { ok: true, job: result.jobs.find((j) => j.id === id) ?? null, fetchedAt: result.fetchedAt };
}
