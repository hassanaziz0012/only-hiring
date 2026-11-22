import "server-only";

// Kept apart from auth.ts, which loads better-auth and the accounts database: the root layout reads this,
// so importing it from there would load both on every page render.

/** Whether the Google button is offered. Read at build time by the root layout. */
export function googleSignInEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
