// Build and deploy the site to production, with the job data the pipeline last exported to data/.
//
//   npm run deploy
//   npm run deploy -- --dry-run    # stage the files and stop, printing the folder
//
// Deploys the committed `main` branch plus data/, not the working tree: the pipeline runs this on a schedule, and
// half-finished edits must not go live with it. Code changes go live once they're committed to main.
//
// Data never goes through Git (see .gitignore), so a Git-triggered build has none and fails.
//
// After the deploy it checks that the live site serves the new data, then announces the jobs the export added to
// IndexNow (Bing, Yandex and others; not Google). Those come from the pipeline's last_sync.json, which is renamed to
// last_sync.sent.json once the site has them (set LAST_SYNC_FILE to read another file).
//
// Reads VERCEL_ORG_ID and VERCEL_PROJECT_ID from the environment or .env.local. The Vercel CLI must be signed in.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = join(import.meta.dirname, "..");
const SITE = "https://onlyhiring.hassandev.me";
const DATA_FILES = ["jobs.json", "subreddit-stats.json"];
const LAST_SYNC_FILE = process.env.LAST_SYNC_FILE || join(homedir(), "Desktop/programming/only-hiring-pipeline/last_sync.json");
const DEPLOY_TIMEOUT_MS = 20 * 60 * 1000;

function fail(message) {
  console.error(`[deploy] ${message}`);
  process.exit(1);
}

/** The data files as text, read once so the files checked are the files deployed. Stops if either is unusable. */
function readData() {
  const texts = DATA_FILES.map((name) => {
    try {
      return readFileSync(join(ROOT, "data", name), "utf8");
    } catch (error) {
      return fail(`data/${name} can't be read (${error.message}). Run \`onlyhiring export\` first.`);
    }
  });
  let jobs, stats;
  try {
    [jobs, stats] = texts.map((t) => JSON.parse(t));
  } catch (error) {
    fail(`data/ is damaged (${error.message}). Run \`onlyhiring export\` again.`);
  }
  if (!jobs.jobs?.length || !stats.subreddits?.length || !jobs.synced_at) fail("data/ has no jobs or no subreddits.");
  return { texts, syncedAt: new Date(jobs.synced_at).toISOString(), count: jobs.jobs.length };
}

/** A clean copy of main plus the data, outside the repo so the CLI doesn't pick up its .vercel link. */
function stage(texts) {
  const dir = mkdtempSync(join(tmpdir(), "only-hiring-deploy-"));
  const archive = execFileSync("git", ["archive", "main"], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", dir], { input: archive });
  if (!existsSync(join(dir, "src/lib/data.ts"))) {
    rmSync(dir, { recursive: true, force: true });
    fail("main doesn't read its jobs from data/ yet, so a deploy of it would show old ones.");
  }
  // The CLI skips whatever .gitignore lists, which includes data/.
  rmSync(join(dir, ".gitignore"), { force: true });
  mkdirSync(join(dir, "data"));
  DATA_FILES.forEach((name, i) => writeFileSync(join(dir, "data", name), texts[i]));
  return dir;
}

async function isLive(syncedAt) {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${SITE}/api/jobs`, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    const list = res?.ok ? await res.json().catch(() => null) : null;
    if (list?.syncedAt === syncedAt) return true;
    await sleep(3000);
  }
  return false;
}

/** Tell IndexNow about the new jobs that the sitemap lists, and the homepage, which lists them too. */
async function announce(ids) {
  if (ids.length === 0) return;
  // The key file proves we own the host.
  const key = readdirSync(join(ROOT, "public")).map((f) => f.match(/^([0-9a-f]{32})\.txt$/)?.[1]).find(Boolean);
  if (!key) return console.error("[deploy] no IndexNow key file in public/, so nothing was announced");
  try {
    const sitemap = await (await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(20_000) })).text();
    const urls = ids.map((id) => `${SITE}/jobs/${id}`).filter((url) => sitemap.includes(`<loc>${url}</loc>`));
    if (urls.length === 0) return console.log("[deploy] no new indexable jobs to announce");
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/${key}.txt`, urlList: [`${SITE}/`, ...urls] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    console.log(`[deploy] announced ${urls.length + 1} URLs to IndexNow`);
  } catch (error) {
    // The jobs are live either way.
    console.error("[deploy] IndexNow submission failed:", error.message);
  }
}

if (existsSync(join(ROOT, ".env.local"))) process.loadEnvFile(join(ROOT, ".env.local"));
if (!process.env.VERCEL_ORG_ID || !process.env.VERCEL_PROJECT_ID) fail("VERCEL_ORG_ID and VERCEL_PROJECT_ID aren't set, in the environment or .env.local.");

// Read before the data, so a job exported in between is announced by the next deploy, not lost.
const lastSync = existsSync(LAST_SYNC_FILE) ? readFileSync(LAST_SYNC_FILE, "utf8") : null;
const { texts, syncedAt, count } = readData();
const commit = execFileSync("git", ["log", "-1", "--format=%h %s", "main"], { cwd: ROOT, encoding: "utf8" }).trim();
const dir = stage(texts);
console.log(`[deploy] main at ${commit}, with ${count} jobs exported ${syncedAt}`);

if (process.argv.includes("--dry-run")) {
  console.log(`[deploy] dry run: staged in ${dir}`);
  process.exit(0);
}

// Only what the CLI needs: .env.local's secrets stay out of the child's environment.
const { PATH, HOME, VERCEL_ORG_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN } = process.env;
const deploy = spawnSync("vercel", ["deploy", "--prod", "--yes"], {
  cwd: dir,
  env: { PATH, HOME, VERCEL_ORG_ID, VERCEL_PROJECT_ID, ...(VERCEL_TOKEN && { VERCEL_TOKEN }) },
  stdio: ["ignore", "inherit", "inherit"],
  timeout: DEPLOY_TIMEOUT_MS,
});
rmSync(dir, { recursive: true, force: true });
if (deploy.error || deploy.status !== 0) fail(`the deploy failed (${deploy.error?.message ?? `exit ${deploy.status}`}). The live site is unchanged.`);

if (!(await isLive(syncedAt))) fail(`the deploy finished, but ${SITE} isn't serving the data exported ${syncedAt}.`);
console.log("[deploy] live");

if (lastSync) {
  let added = [];
  try {
    added = JSON.parse(lastSync).added ?? [];
  } catch {
    console.error(`[deploy] ${LAST_SYNC_FILE} can't be read, so nothing was announced`);
  }
  await announce(added);
  // An export that ran meanwhile has added to the file, so it stays for the next deploy.
  if (existsSync(LAST_SYNC_FILE) && readFileSync(LAST_SYNC_FILE, "utf8") === lastSync) {
    renameSync(LAST_SYNC_FILE, LAST_SYNC_FILE.replace(/\.json$/, ".sent.json"));
  }
}
