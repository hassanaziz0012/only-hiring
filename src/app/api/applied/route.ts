import { accountsDb, sessionUserId } from "@/lib/auth";

// The signed-in user's "applied" marks. Anonymous visitors keep theirs in localStorage instead.

const MAX_IDS = 2000;

function idList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_IDS) return null;
  if (!value.every((v) => typeof v === "string" && v.length > 0 && v.length <= 64)) return null;
  return [...new Set(value as string[])];
}

async function appliedIds(userId: string): Promise<string[]> {
  const { rows } = await accountsDb.query<{ job_id: string }>(
    "SELECT job_id FROM applied_job WHERE user_id = $1 ORDER BY applied_at DESC",
    [userId],
  );
  return rows.map((r) => r.job_id);
}

export async function GET(request: Request) {
  const userId = await sessionUserId(request.headers);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ ids: await appliedIds(userId) }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Body: { add?: string[], remove?: string[] }. Responds with the full list afterwards. */
export async function POST(request: Request) {
  const userId = await sessionUserId(request.headers);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });

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
    await accountsDb.query(
      "INSERT INTO applied_job (user_id, job_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING",
      [userId, add],
    );
  }
  if (remove.length) {
    await accountsDb.query("DELETE FROM applied_job WHERE user_id = $1 AND job_id = ANY($2::text[])", [userId, remove]);
  }
  return Response.json({ ids: await appliedIds(userId) }, { headers: { "Cache-Control": "private, no-store" } });
}
