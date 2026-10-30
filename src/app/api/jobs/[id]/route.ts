import { toApiJobDetail } from "@/lib/api";
import { getJob, getJobs } from "@/lib/db";
import { siteUrl } from "@/lib/site";

// One job as JSON, with the fields only its page shows (red flags, the post's opening lines, how to apply).
// Built like the job pages: the list window's jobs at build time, older ones on first request.

// Unlisted IDs never match a job, so the placeholder answers 404.
const PLACEHOLDER_ID = "_";

export async function generateStaticParams() {
  const result = await getJobs();
  if (!result.ok || result.jobs.length === 0) return [{ id: PLACEHOLDER_ID }];
  return result.jobs.map((job) => ({ id: job.id }));
}

const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(_request: Request, { params }: RouteContext<"/api/jobs/[id]">) {
  const { id } = await params;
  const result = await getJob(id);
  if (!result.ok) {
    return Response.json({ error: "This job can't be loaded right now. Try again in a few minutes." }, { status: 503, headers: CORS });
  }
  if (!result.job) {
    return Response.json({ error: "No job with this ID is on the board." }, { status: 404, headers: CORS });
  }
  return Response.json(toApiJobDetail(result.job, Date.parse(result.fetchedAt), siteUrl()), { headers: CORS });
}
