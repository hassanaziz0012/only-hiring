import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import type { Env } from "./env";

// Optional accounts, so "applied" marks survive cleared browser data and follow the visitor
// across devices. Email and password, plus Google when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
// are set. No email is ever sent, so there's no verification or password reset. Users and their
// marks live in the accounts database (DATABASE_URL). Schema: db/schema.sql.
//
// Password accounts are never email-verified, so better-auth refuses to link a Google sign-in to
// one with the same email (error=account_not_linked). Otherwise anyone could pre-register
// someone's address with a password and keep access once its owner signs in with Google.
//
// Workers can't carry a database connection from one request to the next, so each request gets its own pool,
// and an auth instance around it (about 2 ms of CPU). The caller closes the pool when the response is sent.

export function accountsDb(env: Env): Pool {
  return new Pool({ connectionString: env.DATABASE_URL });
}

function allowedHosts(env: Env): string[] {
  const extra = (env.EXTRA_HOSTS ?? "").split(",").map((h) => h.trim());
  return [new URL(env.SITE_URL).host, ...extra].filter(Boolean);
}

export const googleEnabled = (env: Env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export function createAuth(env: Env, db: Pool) {
  return betterAuth({
    database: db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: { allowedHosts: allowedHosts(env), fallback: new URL(env.SITE_URL).origin },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    socialProviders: googleEnabled(env)
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
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
    // Worker instances don't share memory, so count attempts in the database.
    rateLimit: { enabled: true, storage: "database" },
    advanced: {
      // On by default, and it inspects the whole schema when the instance is created, which would wake the Neon
      // compute on every request. After changing the options above, compare the tables with db/schema.sql by hand.
      database: { validateSchema: false },
      // Cloudflare's own header, which a visitor can't set.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });
}

/** The signed-in user's id for this request, or null. */
export async function sessionUserId(env: Env, db: Pool, headers: Headers): Promise<string | null> {
  const session = await createAuth(env, db).api.getSession({ headers });
  return session?.user.id ?? null;
}
