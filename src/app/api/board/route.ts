import { getJobs } from "@/lib/db";

// The homepage's full job list, which the board fetches after the page loads (see BoardPreview in
// components/board/filters.ts). Built from the cached job list, so it's prerendered and served from the CDN until
// the next sync clears the tag: fetching it never runs a function or touches the database.

export async function GET() {
  const result = await getJobs();
  if (!result.ok) {
    return Response.json({ error: "The job list can't be loaded right now. Try again in a few minutes." }, { status: 503 });
  }
  return Response.json({ fetchedAt: result.fetchedAt, jobs: result.jobs });
}
