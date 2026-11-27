import { toApiJob, type ApiJobList } from "@/lib/api";
import { getJobs } from "@/lib/data";
import { siteUrl } from "@/lib/site";

// Every job in the list window as JSON, for agents and the MCP server. Served at /api/jobs (API_JOBS_FILE in
// lib/api.ts explains why the file is named this). A static file, so reading it never runs the Worker.

export const dynamic = "force-static";

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
