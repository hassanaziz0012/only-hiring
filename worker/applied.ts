import { sessionUserId } from "./auth";
import type { Db } from "./db";
import type { Env } from "./env";

// /api/applied: the signed-in user's "applied" marks. Anonymous visitors keep theirs in localStorage instead.

const MAX_IDS = 2000;
const PRIVATE = { "Cache-Control": "private, no-store" };

function idList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_IDS) return null;
  if (!value.every((v) => typeof v === "string" && v.length > 0 && v.length <= 64)) return null;
  return [...new Set(value as string[])];
}

async function appliedIds(db: Db, userId: string): Promise<string[]> {
  const { rows } = await db.query<{ job_id: string }>(
    "SELECT job_id FROM applied_job WHERE user_id = $1 ORDER BY applied_at DESC",
    [userId],
  );
  return rows.map((r) => r.job_id);
}

/** GET: the list. POST, body { add?: string[], remove?: string[] }: responds with the full list afterwards. */
export async function applied(request: Request, env: Env, db: Db): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  }
  const userId = await sessionUserId(env, request.headers);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (request.method === "GET") return Response.json({ ids: await appliedIds(db, userId) }, { headers: PRIVATE });

  let body: { add?: unknown; remove?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const add = idList(body?.add);
  const remove = idList(body?.remove);
  if (!add || !remove) return Response.json({ error: "Invalid job ids" }, { status: 400 });

  if (add.length) {
    await db.query("INSERT INTO applied_job (user_id, job_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING", [
      userId,
      add,
    ]);
  }
  if (remove.length) {
    await db.query("DELETE FROM applied_job WHERE user_id = $1 AND job_id = ANY($2::text[])", [userId, remove]);
  }
  return Response.json({ ids: await appliedIds(db, userId) }, { headers: PRIVATE });
}
