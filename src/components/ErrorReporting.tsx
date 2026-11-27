// Browser error reporting to Sentry, only when NEXT_PUBLIC_SENTRY_DSN is set at build time.
//
// Sentry's loader script is small and fetches the full SDK only once there is something to report, so visitors
// who hit no error never download it. Besides uncaught errors, it reports this site's own /api/ and /mcp
// requests that answer 5xx. That covers requests the Worker can't report itself, chiefly one that runs past the
// free plan's CPU limit and is killed with error 1102 (a 503).

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/** Wraps fetch before any other script runs, so the first session request is covered too. */
const FETCH_WATCH = `(() => {
  const f = window.fetch;
  // The loader is async: until it has run, retry for up to 10 s.
  const report = (message, context, tries = 0) =>
    window.Sentry ? Sentry.captureMessage(message, context) : tries < 20 && setTimeout(() => report(message, context, tries + 1), 500);
  window.fetch = async function (input, init) {
    const res = await f.apply(this, arguments);
    try {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (res.status >= 500 && url.origin === location.origin && /^\\/(api\\/|mcp)/.test(url.pathname)) {
        const method = (init && init.method) || (input instanceof Request ? input.method : "GET");
        report(method + " " + url.pathname + " answered " + res.status, {
          level: "error",
          tags: { path: url.pathname, status: String(res.status) },
        });
      }
    } catch {}
    return res;
  };
})();`;

export function ErrorReporting() {
  if (!DSN) return null;
  let key: string;
  try {
    key = new URL(DSN).username;
  } catch {
    return null;
  }
  return (
    <>
      <script async src={`https://js.sentry-cdn.com/${key}.min.js`} crossOrigin="anonymous" />
      <script dangerouslySetInnerHTML={{ __html: FETCH_WATCH }} />
    </>
  );
}
