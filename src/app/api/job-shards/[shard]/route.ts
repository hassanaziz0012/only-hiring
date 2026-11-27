import { jobShard, JOB_SHARDS, toApiJobDetail, type ApiJobShard } from "@/lib/api";
import { getAllJobIds, getJob } from "@/lib/data";
import { siteUrl } from "@/lib/site";

// The details behind /api/jobs/<id>, JOB_SHARDS files of many jobs each rather than a file per job (see
// JOB_SHARDS in lib/api.ts). Internal: the Worker reads them and answers /api/jobs/<id> with one job.

export const dynamic = "force-static";

export function generateStaticParams() {
  return Array.from({ length: JOB_SHARDS }, (_, i) => ({ shard: String(i) }));
}

export async function GET(_request: Request, { params }: RouteContext<"/api/job-shards/[shard]">) {
  const shard = Number((await params).shard);
  const base = siteUrl();
  const body: ApiJobShard = {};
  for (const id of getAllJobIds()) {
    if (jobShard(id) !== shard) continue;
    const result = await getJob(id);
    if (result.ok && result.job) body[id] = toApiJobDetail(result.job, Date.parse(result.fetchedAt), base);
  }
  return Response.json(body);
}
