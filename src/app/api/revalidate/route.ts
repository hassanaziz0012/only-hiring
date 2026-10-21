import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { getNewlySyncedJobs, JOBS_CACHE_TAG } from "@/lib/db";
import { submitToIndexNow } from "@/lib/indexnow";
import { isIndexable } from "@/lib/jobs";

function authorized(header: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Drop the cached job list so the next request reads straight from the database, then announce the
 * sync's new indexable jobs (and the homepage, which lists them) to IndexNow.
 */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ revalidated: false }, { status: 401 });
  }
  revalidateTag(JOBS_CACHE_TAG, { expire: 0 });

  const now = Date.now();
  const fresh = await getNewlySyncedJobs().catch((error: unknown) => {
    console.error("[revalidate] could not read new jobs:", error instanceof Error ? error.name : "unknown error");
    return [];
  });
  const paths = fresh.filter((job) => isIndexable(job, now)).map((job) => `/jobs/${job.id}`);
  const indexNow = await submitToIndexNow(paths.length ? ["/", ...paths] : []);

  return Response.json({ revalidated: true, now: new Date(now).toISOString(), indexNow });
}
