// Runs after `next build` (npm run build): readies out/, the static export, for Cloudflare's static assets.
//
// 1. Deletes the job pages' client-navigation files. Job links are plain <a> links (JobItem, JobRow), so a job
//    page is always loaded whole and nothing asks for them, and they were 5 of the 7 files each job cost.
//    Cloudflare's free plan takes 20,000 files per deploy.
// 2. Writes out/_headers: the headers next.config.ts would set on a server, and the Content-Type of the files
//    without an extension (Open Graph images, JSON), which Cloudflare can't tell from the name.
// 3. Fails if out/ has more files than the free plan allows.
//
// NOINDEX=1 adds X-Robots-Tag: noindex to every file, for a test deploy at another address.

import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = join(import.meta.dirname, "..", "out");
const MAX_FILES = 20_000;
// Leave room for the job files a few more deploys will add before anyone notices the warning.
const WARN_FILES = 17_000;

function fail(message) {
  console.error(`[cloudflare-assets] ${message}`);
  process.exit(1);
}

if (!existsSync(join(OUT, "index.html"))) fail("out/ has no index.html. Run `next build` first.");
if (!existsSync(join(OUT, "_redirects"))) fail("out/_redirects is missing (src/app/%5Fredirects).");

// 1. Job pages' client-navigation files: jobs/<id>.txt and jobs/<id>/__next.*.txt.
let removed = 0;
const jobsDir = join(OUT, "jobs");
for (const name of readdirSync(jobsDir)) {
  const path = join(jobsDir, name);
  if (name.endsWith(".txt")) {
    rmSync(path);
    removed++;
  } else if (statSync(path).isDirectory()) {
    for (const file of readdirSync(path)) {
      if (file.startsWith("__next.") && file.endsWith(".txt")) {
        rmSync(join(path, file));
        removed++;
      }
    }
  }
}

// 2. Headers. Rules apply in order and a path can match several. At most 100 rules.
const SECURITY = [
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Content-Security-Policy: frame-ancestors 'none'",
  "X-Frame-Options: DENY",
  "Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()",
];
const contentType = (type) => ["! Content-Type", `Content-Type: ${type}`];

/** Every file under dir, as /paths. */
function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else files.push(`/${relative(OUT, path)}`);
  }
  return files;
}

const files = walk(OUT);
const extensionless = files.filter((f) => !f.split("/").pop().includes(".") && f !== "/_redirects" && f !== "/_headers");

// Open Graph images are the only extensionless files that aren't JSON; one rule covers every job's.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const typeOf = (file) => (readFileSync(join(OUT, file)).subarray(0, 4).equals(PNG) ? "image/png" : "application/json");
const typed = new Map(); // pattern -> type
for (const file of extensionless) {
  // One rule per kind of page: /jobs/:id/opengraph-image covers every job's image, /r/:id/... every subreddit's.
  const pattern = file.replace(/^\/([^/]+)\/[^/]+\/opengraph-image$/, "/$1/:id/opengraph-image").replace(/^\/api\/job-shards\/[^/]+$/, "/api/job-shards/*");
  const type = typeOf(file);
  if (typed.has(pattern) && typed.get(pattern) !== type) fail(`${pattern} matches files of two types`);
  typed.set(pattern, type);
}

const rules = [
  ["/*", [...SECURITY, ...(process.env.NOINDEX === "1" ? ["X-Robots-Tag: noindex"] : [])]],
  // Hashed file names, so they never change.
  ["/_next/static/*", ["Cache-Control: public, max-age=31536000, immutable"]],
  ...[...typed].map(([pattern, type]) => [pattern, contentType(type)]),
  // The Markdown copy duplicates the homepage, and /feed.xml serves the static feed: keep both out of search results.
  ["/index.md", [...contentType("text/markdown; charset=utf-8"), "X-Robots-Tag: noindex"]],
  ["/feed-all.xml", [...contentType("application/rss+xml; charset=utf-8"), "X-Robots-Tag: noindex"]],
  ["/llms.txt", contentType("text/plain; charset=utf-8")],
  // The public JSON API, for agents and other sites.
  ["/api/jobs", ["Access-Control-Allow-Origin: *"]],
  ["/api/jobs.json", ["Access-Control-Allow-Origin: *"]],
  // Internal: the Worker reads them for /api/jobs/<id>.
  ["/api/job-shards/*", ["X-Robots-Tag: noindex"]],
];
if (rules.length > 100) fail(`_headers would have ${rules.length} rules; Cloudflare allows 100.`);
writeFileSync(join(OUT, "_headers"), rules.map(([path, headers]) => `${path}\n${headers.map((h) => `  ${h}`).join("\n")}\n`).join(""));

// 3. File count. _headers and _redirects aren't uploaded as files.
const count = walk(OUT).filter((f) => f !== "/_headers" && f !== "/_redirects").length;
console.log(`[cloudflare-assets] removed ${removed} client-navigation files from job pages; ${count} files to upload`);
if (count > MAX_FILES) fail(`${count} files is more than the ${MAX_FILES} Cloudflare's free plan allows per deploy.`);
if (count > WARN_FILES) console.warn(`[cloudflare-assets] warning: ${count} files is close to the free plan's ${MAX_FILES}.`);
