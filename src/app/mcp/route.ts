import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { API_JOBS_PATH, apiJobPath, type ApiJobDetail, type ApiJobList } from "@/lib/api";
import { jobIdFrom, renderJob, renderSearch, renderSubreddits, searchInput, searchJobs, SERVER_INSTRUCTIONS } from "@/lib/mcp";
import { SITE_NAME, siteUrl } from "@/lib/site";

// The MCP server, at /mcp over Streamable HTTP. Public and read-only, like the site, so there's no auth.
// Tools read the prerendered JSON at /api/jobs through the CDN rather than querying the database: tool calls
// are uncached POSTs, and on serverless an in-memory "use cache" entry rarely survives between them, so each
// call would read the whole list from Neon (see the note above LIST_OMITTED in lib/db.ts).

// Every tool answers in about a second. Without a cap, a client that leaves its request open held a function
// until the platform's 300s limit, 50–120 times a day, which used most of the plan's provisioned memory.
export const maxDuration = 30;

// Deployed, read production's JSON: preview deployments sit behind Vercel's login. Locally, read this server's own.
const origin = (req: Request | undefined) => (process.env.VERCEL || !req ? siteUrl() : new URL(new URL(req.url).origin));

// A warm instance answers repeat calls without refetching. The CDN copy only changes after a sync anyway.
const LIST_TTL_MS = 5 * 60 * 1000;
let listCache: { at: number; list: ApiJobList } | null = null;

async function fetchList(base: URL): Promise<ApiJobList | null> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.list;
  const res = await fetch(new URL(API_JOBS_PATH, base), { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  const list = (await res.json()) as ApiJobList;
  listCache = { at: Date.now(), list };
  return list;
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const failure = (t: string) => ({ ...text(t), isError: true });
const UNAVAILABLE = `${SITE_NAME}'s job list can't be loaded right now. Try again in a few minutes.`;

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_jobs",
      {
        title: "Search jobs",
        description: `Search current hiring posts from Reddit's job subreddits, newest first. With no filters, returns the newest open jobs. Each result has pay, type, location, skills, any scam warning, the ${SITE_NAME} link and the Reddit link to apply.`,
        inputSchema: searchInput,
        annotations: { ...READ_ONLY, title: "Search jobs" },
      },
      async (input, ctx) => {
        if (input.min_pay != null && !input.pay_type) {
          return failure("min_pay needs a pay_type, e.g. hourly or fixed_project, since an hourly rate and a project price don't compare.");
        }
        const list = await fetchList(origin(ctx.http?.req));
        if (!list) return failure(UNAVAILABLE);
        const now = Date.now();
        return text(renderSearch(list, searchJobs(list.jobs, input, now), input, now));
      },
    );

    server.registerTool(
      "get_job",
      {
        title: "Get a job",
        description:
          "One job's full details: summary, pay, skills, languages, test task, how to apply, the opening of the post, and its scam score with the red flags behind it. Also answers \"is this Reddit job post a scam?\" for a post on the board.",
        inputSchema: z.object({
          id: z
            .string()
            .max(300)
            .describe(`The job's ID from search_jobs, its ${SITE_NAME} link, or a link to the Reddit post.`),
        }),
        annotations: { ...READ_ONLY, title: "Get a job" },
      },
      async ({ id }, ctx) => {
        const jobId = jobIdFrom(id);
        if (!jobId) return failure("That isn't a job ID or a link to a Reddit post.");
        const res = await fetch(new URL(apiJobPath(jobId), origin(ctx.http?.req)), { cache: "no-store" }).catch(() => null);
        if (res?.status === 404) {
          return failure(
            `Post ${jobId} isn't on ${SITE_NAME}. It wasn't graded as a hiring post, was removed, or is from a subreddit the site doesn't read (see list_subreddits).`,
          );
        }
        if (!res?.ok) return failure(UNAVAILABLE);
        return text(renderJob((await res.json()) as ApiJobDetail, Date.now()));
      },
    );

    server.registerTool(
      "list_subreddits",
      {
        title: "List subreddits",
        description: `The subreddits ${SITE_NAME} reads, with how many open jobs each has and what gets posted there. Use a name as search_jobs' subreddit filter.`,
        annotations: { ...READ_ONLY, title: "List subreddits" },
      },
      async (ctx) => {
        const base = origin(ctx.http?.req);
        const list = await fetchList(base);
        if (!list) return failure(UNAVAILABLE);
        return text(renderSubreddits(list, siteUrl()));
      },
    );
  },
  { serverInfo: { name: "only-hiring", version: "1.0.0" }, instructions: SERVER_INSTRUCTIONS },
);

export { handler as GET, handler as POST };
