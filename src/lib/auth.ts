import "server-only";

import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { siteUrl } from "./site";

// Optional accounts, so "applied" marks survive cleared browser data and follow the visitor
// across devices. Email and password, plus Google when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
// are set. No email is ever sent, so there's no verification or password reset. Users and their
// marks live in the accounts database (DATABASE_URL), separate from the read-only jobs database.
// Schema: db/schema.sql.
//
// Password accounts are never email-verified, so better-auth refuses to link a Google sign-in to
// one with the same email (error=account_not_linked). Otherwise anyone could pre-register
// someone's address with a password and keep access once its owner signs in with Google.

function allowedHosts(): string[] {
  const hosts = [siteUrl().host, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL];
  if (!process.env.VERCEL) hosts.push("localhost:*", "127.0.0.1:*");
  return hosts.filter((h): h is string => Boolean(h));
}

/** Whether the Google button is offered. Read at build time by the root layout. */
export function googleSignInEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const accountsDb = new Pool({ connectionString: process.env.DATABASE_URL });

export const auth = betterAuth({
  database: accountsDb,
  baseURL: { allowedHosts: allowedHosts(), fallback: siteUrl().origin },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  socialProviders: googleSignInEnabled()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},
  user: { deleteUser: { enabled: true } },
  session: {
    expiresIn: 60 * 60 * 24 * 60,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Serverless instances don't share memory, so count attempts in the database.
  rateLimit: { enabled: true, storage: "database" },
});

/** The signed-in user's id for this request, or null. */
export async function sessionUserId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
