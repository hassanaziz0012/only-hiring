import { getJobs } from "@/lib/data";

// The homepage's full job list, which the board fetches after the page loads (see BoardPreview in
// components/board/filters.ts). Prerendered and served from the CDN, so fetching it never runs a function.

export async function GET() {
  const result = await getJobs();
  if (!result.ok) {
    return Response.json({ error: "The job list can't be loaded right now. Try again in a few minutes." }, { status: 503 });
  }
  return Response.json({ fetchedAt: result.fetchedAt, jobs: result.jobs });
}
