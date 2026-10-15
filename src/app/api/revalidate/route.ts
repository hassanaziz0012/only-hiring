import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { JOBS_CACHE_TAG } from "@/lib/db";

function authorized(header: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Drop the cached job list so the next request reads straight from the database. */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ revalidated: false }, { status: 401 });
  }
  revalidateTag(JOBS_CACHE_TAG, { expire: 0 });
  return Response.json({ revalidated: true, now: new Date().toISOString() });
}
