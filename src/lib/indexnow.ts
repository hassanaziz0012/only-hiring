import "server-only";

import { INDEXNOW_KEY, siteUrl } from "./site";

/**
 * Tell IndexNow search engines (Bing, Yandex and others; not Google) that these paths changed.
 * The key file at /<INDEXNOW_KEY>.txt proves we own the host. Returns the number of URLs sent,
 * or null when nothing was sent.
 */
export async function submitToIndexNow(paths: string[]): Promise<number | null> {
  // Only production URLs are worth announcing, and previews would fail the key check anyway.
  if (process.env.VERCEL_ENV !== "production" || paths.length === 0) return null;
  const base = siteUrl();
  const urlList = paths.map((path) => new URL(path, base).toString());
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: base.host,
        key: INDEXNOW_KEY,
        keyLocation: new URL(`/${INDEXNOW_KEY}.txt`, base).toString(),
        urlList,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[indexnow] submission failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    return urlList.length;
  } catch (error) {
    console.error("[indexnow] submission failed", error instanceof Error ? error.message : error);
    return null;
  }
}
