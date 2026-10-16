import { createHash } from "node:crypto";
import { accountsDb } from "@/lib/auth";
import { removalEmail, SITE_NAME } from "@/lib/site";

// Anonymous feedback from the header's Feedback dialog. Each message is stored in the accounts
// database, then emailed to REMOVAL_EMAIL through Resend (RESEND_API_KEY). The sender's account,
// if they're signed in, is never attached.

const MAX_MESSAGE = 4000;
const MAX_PER_HOUR = 5;
const FROM = `${SITE_NAME} feedback <feedback@hassandev.me>`;

function ipHash(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? ""}:${ip}`)
    .digest("hex");
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

async function sendEmail(message: string, replyEmail: string | null, page: string | null): Promise<boolean> {
  const to = removalEmail();
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) return false;
  const body = [message, "", "—", `Page: ${page ?? "unknown"}`, `Reply to: ${replyEmail ?? "not given"}`].join("\n");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `Feedback: ${message.replace(/\s+/g, " ").slice(0, 60)}`,
      text: body,
      ...(replyEmail && { reply_to: replyEmail }),
    }),
  }).catch(() => null);
  if (!res?.ok) console.error("Feedback email failed", res?.status, await res?.text().catch(() => ""));
  return Boolean(res?.ok);
}

/** Body: { message: string, email?: string, page?: string, website?: string (honeypot) }. */
export async function POST(request: Request) {
  let body: { message?: unknown; email?: unknown; page?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Hidden from people, so only bots fill it in. Pretend it worked.
  if (body?.website) return Response.json({ ok: true });

  const message = text(body?.message, MAX_MESSAGE);
  if (!message) return Response.json({ error: "Write a message first." }, { status: 400 });
  const email = text(body?.email, 254);
  if (email &&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }
  const page = text(body?.page, 300);

  const hash = ipHash(request.headers);
  const { rows } = await accountsDb.query<{ count: string }>(
    "SELECT count(*) FROM feedback WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'",
    [hash],
  );
  if (Number(rows[0].count) >= MAX_PER_HOUR) {
    return Response.json({ error: "That's a lot of feedback at once. Try again in an hour." }, { status: 429 });
  }

  const inserted = await accountsDb.query<{ id: string }>(
    "INSERT INTO feedback (message, reply_email, page, ip_hash) VALUES ($1, $2, $3, $4) RETURNING id",
    [message, email, page?.startsWith("/") ? page : null, hash],
  );
  if (await sendEmail(message, email, page)) {
    await accountsDb.query("UPDATE feedback SET emailed = true WHERE id = $1", [inserted.rows[0].id]);
  }
  return Response.json({ ok: true });
}
