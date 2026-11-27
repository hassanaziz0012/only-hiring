import type { Env } from "./env";

// JSON files from the static export, read through the assets binding: no network, and they're free to read.
// Each file only changes with a deploy, and a deploy starts fresh Worker instances, so a file is parsed at most
// once per instance. Only the parsed value is kept, never a pending promise: a promise one request started
// mustn't be awaited by another.

const parsed = new Map<string, unknown>();

/** The parsed file, or null if it's missing or unreadable. */
export async function assetJson<T>(env: Env, path: string): Promise<T | null> {
  if (parsed.has(path)) return parsed.get(path) as T;
  const res = await env.ASSETS.fetch(new Request(new URL(path, "https://assets.local"))).catch(() => null);
  if (!res?.ok) return null;
  const value = (await res.json().catch(() => null)) as T | null;
  if (value !== null) parsed.set(path, value);
  return value;
}
