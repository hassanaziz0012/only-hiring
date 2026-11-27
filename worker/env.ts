// The Worker's bindings (wrangler.jsonc). Secrets are set with `wrangler secret put`; see README.md.

export interface Env {
  /** The static export in out/: every page, image, feed and JSON file. */
  ASSETS: Fetcher;
  /** The canonical site, e.g. https://onlyhiring.hassandev.me. Sign-in falls back to it. */
  SITE_URL: string;
  /** Other hosts sign-in may answer on, comma-separated (the workers.dev address, localhost:* in development). */
  EXTRA_HOSTS?: string;
  /** "1" on a test deploy: the Worker's responses get X-Robots-Tag: noindex (out/_headers does the same for files). */
  NOINDEX?: string;

  // Secrets
  /** Accounts database (users, sessions, applied marks, feedback). Tables in db/schema.sql. */
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Feedback is emailed here through Resend. */
  REMOVAL_EMAIL?: string;
  RESEND_API_KEY?: string;
}
