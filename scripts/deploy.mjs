// Build the site and deploy it to Cloudflare, with the job data the pipeline last exported to data/.
//
//   npm run deploy
//   npm run deploy -- --dry-run          # stage the files and stop, printing the folder
//   npm run deploy -- --test --ref BRANCH  # a branch to the workers.dev address, noindexed, no IndexNow
//
// Deploys the committed `main` branch plus data/, not the working tree: the pipeline runs this on a schedule, and
// half-finished edits must not go live with it. Code changes go live once they're committed to main.
//
// The build is a static export (out/) plus the Worker in worker/; `wrangler deploy` uploads both, and only the
// files that changed. Data never goes through Git (see .gitignore), so a build without data/ fails.
//
// After the deploy it checks that the live site serves the new data, then announces the jobs the export added to
// IndexNow (Bing, Yandex and others; not Google). Those come from the pipeline's last_sync.json, which is renamed to
// last_sync.sent.json once the site has them (set LAST_SYNC_FILE to read another file).
//
// Wrangler must be signed in (`npx wrangler login`), or CLOUDFLARE_API_TOKEN set. The Worker's secrets are set once
// with `wrangler secret put` (README.md), not here. Build-time settings come from the environment or .env.local:
// REMOVAL_EMAIL, GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (whether to show the Google button) and
// NEXT_PUBLIC_CF_ANALYTICS_TOKEN (Cloudflare Web Analytics) and NEXT_PUBLIC_SENTRY_DSN (browser error reports).

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = join(import.meta.dirname, "..");
const TEST = process.argv.includes("--test");
const REF = process.argv.includes("--ref") ? process.argv[process.argv.indexOf("--ref") + 1] : "main";
// Where to check that the deploy is live. A test deploy is only at the workers.dev address.
const SITE = TEST ? "https://onlyhiring.hassanaziz0012.workers.dev" : "https://onlyhiring.hassandev.me";
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

/** A clean copy of the branch plus the data, outside the repo, so nothing uncommitted is built. */
function stage(texts) {
  const dir = mkdtempSync(join(tmpdir(), "only-hiring-deploy-"));
  const archive = execFileSync("git", ["archive", REF], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", dir], { input: archive });
  if (!existsSync(join(dir, "wrangler.jsonc"))) {
    rmSync(dir, { recursive: true, force: true });
    fail(`${REF} isn't set up for Cloudflare (no wrangler.jsonc).`);
  }
  // The fonts are gitignored too (their licence allows self-hosting, not redistribution). Reuse the local copy
  // rather than fetching them again; the build fetches them if there's none.
  if (existsSync(join(ROOT, "src/app/fonts"))) cpSync(join(ROOT, "src/app/fonts"), join(dir, "src/app/fonts"), { recursive: true });
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

// Read before the data, so a job exported in between is announced by the next deploy, not lost.
const lastSync = existsSync(LAST_SYNC_FILE) ? readFileSync(LAST_SYNC_FILE, "utf8") : null;
const { texts, syncedAt, count } = readData();
const commit = execFileSync("git", ["log", "-1", "--format=%h %s", REF], { cwd: ROOT, encoding: "utf8" }).trim();
const dir = stage(texts);
console.log(`[deploy] ${REF} at ${commit}, with ${count} jobs exported ${syncedAt}${TEST ? " (test deploy)" : ""}`);

if (process.argv.includes("--dry-run")) {
  console.log(`[deploy] dry run: staged in ${dir}`);
  process.exit(0);
}

/** Run a command in the staged folder, with only the environment it needs: .env.local's other secrets stay out. */
function run(command, args, extraEnv = {}) {
  const pick = (keys) => Object.fromEntries(keys.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
  const result = spawnSync(command, args, {
    cwd: dir,
    env: { ...pick(["PATH", "HOME", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]), ...extraEnv },
    stdio: ["ignore", "inherit", "inherit"],
    timeout: DEPLOY_TIMEOUT_MS,
  });
  if (result.error || result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    fail(`\`${command} ${args.join(" ")}\` failed (${result.error?.message ?? `exit ${result.status}`}). The live site is unchanged.`);
  }
}

const buildEnv = Object.fromEntries(
  ["REMOVAL_EMAIL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NEXT_PUBLIC_CF_ANALYTICS_TOKEN", "NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SITE_URL"]
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
run("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"]);
run("npm", ["run", "build"], { ...buildEnv, NEXT_TELEMETRY_DISABLED: "1", ...(TEST && { NOINDEX: "1" }) });
run("npx", ["wrangler", "deploy", ...(TEST ? ["--var", "NOINDEX:1"] : [])]);
rmSync(dir, { recursive: true, force: true });

if (!(await isLive(syncedAt))) fail(`the deploy finished, but ${SITE} isn't serving the data exported ${syncedAt}.`);
console.log("[deploy] live");

if (lastSync && !TEST) {
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
