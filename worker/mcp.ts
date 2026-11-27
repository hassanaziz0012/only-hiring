import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { API_JOBS_FILE, jobShard, jobShardPath, type ApiJobDetail, type ApiJobList, type ApiJobShard } from "@/lib/api";
import { jobIdFrom, renderJob, renderSearch, renderSubreddits, searchInput, searchJobs, SERVER_INSTRUCTIONS } from "@/lib/mcp";
import { SITE_NAME } from "@/lib/site";
import { assetJson } from "./assets";
import type { Env } from "./env";

// The MCP server, at /mcp over Streamable HTTP. Public and read-only, like the site, so there's no auth.
// The tools read the same JSON the public API serves (/api/jobs and the job shards), straight from the static
// assets.

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const failure = (t: string) => ({ ...text(t), isError: true });
const UNAVAILABLE = `${SITE_NAME}'s job list can't be loaded right now. Try again in a few minutes.`;

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

/** The handler for one Worker's bindings. Built once per instance; it creates a server per request. */
function build(env: Env, site: URL) {
  const list = () => assetJson<ApiJobList>(env, API_JOBS_FILE);
  return createMcpHandler(
    (server) => {
      server.registerTool(
        "search_jobs",
        {
          title: "Search jobs",
          description: `Search current hiring posts from Reddit's job subreddits, newest first. With no filters, returns the newest open jobs. Each result has pay, type, location, skills, any scam warning, the ${SITE_NAME} link and the Reddit link to apply.`,
          inputSchema: searchInput,
          annotations: { ...READ_ONLY, title: "Search jobs" },
        },
        async (input) => {
          if (input.min_pay != null && !input.pay_type) {
            return failure("min_pay needs a pay_type, e.g. hourly or fixed_project, since an hourly rate and a project price don't compare.");
          }
          const jobs = await list();
          if (!jobs) return failure(UNAVAILABLE);
          const now = Date.now();
          return text(renderSearch(jobs, searchJobs(jobs.jobs, input, now), input, now));
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
        async ({ id }) => {
          const jobId = jobIdFrom(id);
          if (!jobId) return failure("That isn't a job ID or a link to a Reddit post.");
          const shard = await assetJson<ApiJobShard>(env, jobShardPath(jobShard(jobId)));
          if (!shard) return failure(UNAVAILABLE);
          const job: ApiJobDetail | undefined = shard[jobId];
          if (!job) {
            return failure(
              `Post ${jobId} isn't on ${SITE_NAME}. It wasn't graded as a hiring post, was removed, or is from a subreddit the site doesn't read (see list_subreddits).`,
            );
          }
          return text(renderJob(job, Date.now()));
        },
      );

      server.registerTool(
        "list_subreddits",
        {
          title: "List subreddits",
          description: `The subreddits ${SITE_NAME} reads, with how many open jobs each has and what gets posted there. Use a name as search_jobs' subreddit filter.`,
          annotations: { ...READ_ONLY, title: "List subreddits" },
        },
        async () => {
          const jobs = await list();
          if (!jobs) return failure(UNAVAILABLE);
          return text(renderSubreddits(jobs, site));
        },
      );
    },
    { serverInfo: { name: "only-hiring", version: "1.0.0" }, instructions: SERVER_INSTRUCTIONS },
  );
}

let handler: ReturnType<typeof build> | null = null;

export function mcp(request: Request, env: Env): Promise<Response> {
  handler ??= build(env, new URL(env.SITE_URL));
  return handler(request);
}
