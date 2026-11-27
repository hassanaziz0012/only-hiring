import type { Env } from "./env";

// Error reporting to Sentry, without the SDK: nothing runs on a request that succeeds, so it costs no CPU against
// the free plan's 10 ms. On a failure it sends one event in the background (ctx.waitUntil), after the response.
//
// It reports thrown errors and 5xx responses (better-auth answers some failures with a 500 rather than throwing).
// A request that runs out of CPU (error 1102) is killed before any code can report it; the browser reports
// those (src/components/ErrorReporting.tsx), and Workers Logs record them with outcome "exceededCpu".
//
// SENTRY_DSN is a Worker secret. Without it, nothing is sent.

type Frame = { function?: string; filename?: string; lineno?: number; colno?: number; in_app: boolean };

/** V8 stack lines ("    at fn (file:1:2)"), oldest call first, as Sentry wants them. */
function frames(stack: string | undefined): Frame[] {
  const out: Frame[] = [];
  for (const line of stack?.split("\n").slice(1) ?? []) {
    const m = line.match(/^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);
    if (m) out.push({ function: m[1], filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: true });
  }
  return out.reverse();
}

export function reportError(env: Env, ctx: ExecutionContext, request: Request, problem: unknown, status?: number): void {
  if (!env.SENTRY_DSN) return;
  let dsn: URL;
  try {
    dsn = new URL(env.SENTRY_DSN);
  } catch {
    return;
  }
  const projectId = dsn.pathname.replace(/^\//, "");
  const url = new URL(request.url);
  const error = problem instanceof Error ? problem : null;
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    logger: "worker",
    environment: env.NOINDEX === "1" ? "test" : "production",
    // No query string (OAuth callbacks carry codes there), no headers or cookies.
    request: { url: `${url.origin}${url.pathname}`, method: request.method },
    tags: { path: url.pathname, ...(status && { status: String(status) }), colo: String((request.cf as { colo?: string } | undefined)?.colo ?? "") },
    ...(error
      ? { exception: { values: [{ type: error.name, value: error.message, stacktrace: { frames: frames(error.stack) } }] } }
      : { message: { formatted: `${request.method} ${url.pathname} answered ${status}: ${String(problem).slice(0, 500)}` } }),
  };
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: env.SENTRY_DSN }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  ctx.waitUntil(
    fetch(`${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.username}, sentry_client=onlyhiring-worker/1.0`,
      },
      body: envelope,
    })
      .then((res) => {
        if (!res.ok) console.error("[sentry] event not accepted:", res.status);
      })
      .catch((e) => console.error("[sentry] event not sent:", e)),
  );
}
