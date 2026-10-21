// Site-wide constants. Product rules live here so they're easy to find and change.

export const SITE_NAME = "Only Hiring";

export const SITE_DESCRIPTION =
  "Hiring posts only, from r/forhire, r/hiring, r/RemoteJobs and other job subreddits. Self-promotion and spam are filtered out, and every job gets a scam score.";

/**
 * Contact for removal requests, from the REMOVAL_EMAIL env var. Server-side only:
 * call it from server components. Null when unset.
 */
export function removalEmail(): string | null {
  return process.env.REMOVAL_EMAIL?.trim() || null;
}

/** Public source repository. Set once the repo is public; links are hidden while null. */
export const SOURCE_URL: string | null = "https://github.com/hassanaziz0012/only-hiring";

/** Jobs posted longer ago than this move to the collapsed "older posts" section. */
export const EXPIRY_DAYS = 14;

/** Jobs at or above this scam score are hidden unless the visitor chooses to see them. */
export const SCAM_HIDE_THRESHOLD = 0.6;

/** Jobs at or above this scam score carry a visible warning. */
export const SCAM_WARN_THRESHOLD = 0.4;

/**
 * Absolute base URL for metadata (Open Graph, sitemap). Vercel sets
 * VERCEL_PROJECT_PRODUCTION_URL automatically; NEXT_PUBLIC_SITE_URL overrides it.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
