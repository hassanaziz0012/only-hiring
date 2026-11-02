import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { getNewlySyncedJobs, getTitleTags, JOB_PAGES_TAG, jobTag, JOBS_CACHE_TAG } from "@/lib/db";
import { submitToIndexNow } from "@/lib/indexnow";
import { isIndexable } from "@/lib/jobs";

function authorized(header: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Reddit post IDs are short base-36 strings. Anything else in the body is ignored.
const ID = /^[a-z0-9]{1,16}$/;
const MAX_IDS = 5000;

/**
 * What the sync changed, from the pipeline's last_sync.json via refresh.sh: `changed` holds the jobs it
 * added or whose content changed, `removed` the ones it deleted. `all` clears every job page instead.
 * An empty or missing body still clears the lists and the jobs the latest sync added.
 */
type Changes = { changed: string[]; removed: string[]; all: boolean };

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && ID.test(v)).slice(0, MAX_IDS);
}

async function readChanges(request: Request): Promise<Changes> {
  const body: unknown = await request.json().catch(() => null);
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return { changed: ids(obj.changed), removed: ids(obj.removed), all: obj.all === true };
}

/**
 * Drop the cached job lists so the next request reads straight from the database, and the cached pages of
 * just the jobs the sync touched, then announce the sync's new indexable jobs (and the homepage, which lists
 * them) to IndexNow.
 *
 * Job pages are cleared one by one rather than all at once: each rebuild writes the page, its prefetch
 * segments and its image to the ISR cache, and bots revisit every job, so clearing them all after each sync
 * used up most of the plan's ISR writes.
 */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ revalidated: false }, { status: 401 });
  }
  const changes = await readChanges(request);
  revalidateTag(JOBS_CACHE_TAG, { expire: 0 });

  const now = Date.now();
  const fresh = await getNewlySyncedJobs().catch((error: unknown) => {
    console.error("[revalidate] could not read new jobs:", error instanceof Error ? error.name : "unknown error");
    return [];
  });

  let jobPages: number | "all";
  let titles = 0;
  if (changes.all) {
    revalidateTag(JOB_PAGES_TAG, { expire: 0 });
    jobPages = "all";
  } else {
    // New jobs are in `changed` too; the fresh ones are added in case refresh.sh had no change list.
    const updated = [...new Set([...changes.changed, ...fresh.map((job) => job.id)])];
    const touched = new Set([...updated, ...changes.removed]);
    for (const id of touched) revalidateTag(jobTag(id), { expire: 0 });
    jobPages = touched.size;

    // A new or retitled job can share its title with older ones, whose titles then get their dates.
    const titleTags = await getTitleTags(updated).catch((error: unknown) => {
      console.error("[revalidate] could not read job titles:", error instanceof Error ? error.name : "unknown error");
      return [];
    });
    for (const tag of titleTags) revalidateTag(tag, { expire: 0 });
    titles = titleTags.length;
  }

  const paths = fresh.filter((job) => isIndexable(job, now)).map((job) => `/jobs/${job.id}`);
  const indexNow = await submitToIndexNow(paths.length ? ["/", ...paths] : []);

  return Response.json({ revalidated: true, now: new Date(now).toISOString(), jobPages, titles, indexNow });
}
