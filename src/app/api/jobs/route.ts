import { toApiJob, type ApiJobList } from "@/lib/api";
import { getJobs } from "@/lib/db";
import { siteUrl } from "@/lib/site";

// Every job in the list window as JSON, for agents and the MCP server. Built from the cached job list like the
// feed, so it's prerendered and served from the CDN until the next sync clears the tag: reading it never
// touches the database, however often it's fetched. See the note above LIST_OMITTED in lib/db.ts.

export async function GET() {
  const result = await getJobs();
  if (!result.ok) {
    return Response.json({ error: "The job list can't be loaded right now. Try again in a few minutes." }, { status: 503 });
  }
  const at = Date.parse(result.fetchedAt);
  const base = siteUrl();
  const body: ApiJobList = {
    fetchedAt: result.fetchedAt,
    syncedAt: result.syncedAt,
    jobs: result.jobs.map((job) => toApiJob(job, at, base)),
  };
  return Response.json(body, { headers: { "Access-Control-Allow-Origin": "*" } });
}
