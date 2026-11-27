import { getJobs } from "@/lib/data";

// The homepage's full job list, which the board fetches after the page loads (see BoardPreview in
// components/board/filters.ts). A static file. The Worker reads it too, through the assets binding, to build
// filtered feeds (worker/feed.ts).

export const dynamic = "force-static";

export async function GET() {
  const result = await getJobs();
  if (!result.ok) {
    return Response.json({ error: "The job list can't be loaded right now. Try again in a few minutes." }, { status: 503 });
  }
  return Response.json({ fetchedAt: result.fetchedAt, syncedAt: result.syncedAt, jobs: result.jobs });
}
