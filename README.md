# Only Hiring

[![Only Hiring - Listed on Claude AI Directory](https://www.claudeai.directory/badge/only-hiring)](https://www.claudeai.directory/launches/only-hiring)
[![mcptry](https://mcptry.com/badge/io.github.hassanaziz0012/only-hiring)](https://mcptry.com/servers/io.github.hassanaziz0012/only-hiring)

A job board for Reddit's hiring subreddits, minus the noise.

About three in four posts on subreddits like r/forhire, r/slavelabour or r/DesignJobs are people advertising their own services, discussion or spam. This site lists only the posts where someone is actually hiring. Each job has a short summary, structured fields (pay, role, work mode, location, skills) and a link back to the original Reddit post, which is where you apply.

## How it works

```
[private pipeline (not in this repo)]
  scrape new posts → grade each post with a language model → write data/*.json
                                                                   │
                                                                   ▼ scripts/deploy.mjs
[this repo, on Cloudflare]  Next.js builds every page from data/ as static files; a small Worker does the rest
```

- **Collect.** On a schedule, the pipeline reads the newest posts from about 19 hiring subreddits. Posts tagged `[For Hire]` or `[Offer]` are skipped.
- **Grade.** A language model decides whether each post is hiring, writes a summary, extracts pay, skills and location, and gives it a scam score from 0 to 1.
- **Publish.** Only hiring posts are written to `data/jobs.json`. Of each post's body, only the opening lines (about 320 characters) are stored; the site shows its own summary and links to Reddit for the rest. Jobs whose Reddit post was deleted or removed are taken off the board.

**The scraper and grader are not part of this repository.** A separate, private pipeline collects and grades posts on a schedule, writes the jobs to `data/` and deploys the site. This repo is only the website. The data isn't in it either: posts and usernames removed from Reddit would stay in its Git history.

### Product rules

| Rule | Value | Where |
| --- | --- | --- |
| Jobs older than this move to a collapsed "older posts" section | 14 days | `src/lib/site.ts` |
| Jobs at or above this scam score are hidden by default | 0.6 | `src/lib/site.ts` |
| Jobs at or above this scam score show a warning | 0.4 | `src/lib/site.ts` |
| Jobs, counts, stats and what counts as expired change | with every deploy | `scripts/deploy.mjs` |

Filtering, search and sorting run in the browser, since the dataset is small. Filters are kept in the URL, so filtered views can be shared. "Applied" marks are stored in the visitor's `localStorage`, or in their account if they sign in. Accounts are optional (email and password, or Google, via [better-auth](https://www.better-auth.com)); signing in merges the browser's marks into the account. A signed-out visitor who marks a job or opens a post on Reddit is offered an account once, then not again for 14 days after dismissing it.

## Running it locally

Requirements: Node 20+ and npm.

```bash
npm install
cp .env.example .env.local   # then set what you need (all optional, except DATABASE_URL and BETTER_AUTH_SECRET for accounts)
npm run dev
```

The jobs come from `data/jobs.json` and `data/subreddit-stats.json`, which the pipeline writes (the fields are in `JobRow` in `src/lib/jobs.ts` and `parseStatsRow` in `src/lib/subreddits.ts`). Without them `npm run dev` renders a "the job list didn't load" state, and `npm run build` fails rather than publish a site without jobs.

`npm run dev` serves the pages. The routes that need a server (sign-in, applied marks, feedback, `/mcp`, filtered feeds, `/api/jobs/<id>`) are in the Worker: run `npm run build` once, then `npm run dev:worker` alongside, and `next dev` hands those routes to it. The Worker reads its settings from `.dev.vars` (the same keys as below, plus `EXTRA_HOSTS="localhost:*"`). `npm run preview` builds the site and serves all of it from the Worker, as Cloudflare would.

`DATABASE_URL` is a Postgres database for accounts and their applied marks, the only thing that uses a database; create its tables with `db/schema.sql`. `BETTER_AUTH_SECRET` signs session cookies (`openssl rand -base64 32`).

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are optional and turn on "Continue with Google". They come from an OAuth client of type "Web application" in Google Cloud Console, with `https://<your domain>/api/auth/callback/google` as an authorized redirect URI (add `http://localhost:3000/...` for local use). The button is shown only when both are set at build time.

`REMOVAL_EMAIL` is optional config: the address shown for removal requests in the footer and on the About page, read at build time, and where the Worker emails feedback. If it's unset, the site links to this repo's issue tracker instead.

`RESEND_API_KEY` is optional: it emails each message from the header's Feedback dialog to `REMOVAL_EMAIL`, sent from `feedback@hassandev.me` (a domain verified in Resend). Messages are also stored in the accounts database's `feedback` table, so a failed email loses nothing (`emailed` stays false). Each IP can send 5 an hour.

In production the Worker reads these as secrets (see [Hosting on Cloudflare](#hosting-on-cloudflare)), and the build reads `REMOVAL_EMAIL` and the Google pair from `.env.local`.

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`.

`npm run dev` and `npm run build` first run `scripts/fetch-fonts.mjs`, which downloads the Pilcrow Rounded font files from Fontshare into `src/app/fonts/`. That folder is gitignored on purpose; see [License](#license).

### Code map

```
src/
  app/
    page.tsx              home: masthead + job board (server component)
    jobs/[id]/page.tsx    job detail, prerendered for every job
    about/page.tsx        how it works, scam scores, limits, removal requests
    robots.ts, sitemap.ts, opengraph-image.tsx, icon.svg
  components/
    account/              sign-in dialog, header link, session sync
    FeedbackNav.tsx       header Feedback link and dialog (posts to /api/feedback, in the Worker)
    board/                client-side filters, search, sorting, grouping
    JobItem.tsx           one job in the list
    JobDetail.tsx         the detail view
  lib/
    data.ts               reads the job data from data/*.json (server-only)
    jobs.ts               job type, defensive parsing, expiry and scam rules
    labels.ts             human labels for enum-like columns
    format.ts             pay, date and time formatting
    applied.ts            the "applied" store: localStorage, or the account when signed in
    google-sign-in.ts     whether Google sign-in is set up, read at build time
    site.ts               site name, thresholds, removal contact
worker/
  index.ts                the Cloudflare Worker: routes the few requests that aren't static files
  auth.ts                 better-auth config
  db.ts                   the accounts database over Neon's HTTP API
  applied.ts, feedback.ts, mcp.ts, feed.ts
scripts/
  cloudflare-assets.mjs   after the build: writes out/_headers, trims out/ to fit the free plan
  deploy.mjs              builds and deploys to Cloudflare
```

The site is a static export (`output: "export"` in `next.config.ts`): `next build` writes every page to `out/`, and nothing renders per request. A static export ignores `headers()`, `redirects()` and `rewrites()`, so `out/_headers` comes from `scripts/cloudflare-assets.mjs` and `out/_redirects` from `src/app/%5Fredirects`.

### Deploying

`npm run deploy` (`scripts/deploy.mjs`) builds the committed `main` branch plus `data/` in a temporary folder and deploys it to Cloudflare with wrangler. The pipeline runs it after every export, so uncommitted work is never deployed, and anything committed to `main` goes live with the next run. It then checks that the live site has the new data and announces new jobs to IndexNow. Wrangler must be signed in (`npx wrangler login`) or `CLOUDFLARE_API_TOKEN` set.

`npm run deploy -- --test --ref <branch>` deploys a branch to https://onlyhiring.hassanaziz0012.workers.dev instead, with `X-Robots-Tag: noindex` and no IndexNow. While the custom domain isn't on the Worker, that's the only address it has; once it is, a test deploy replaces production.

A Git push doesn't deploy: Git has no data.

### Hosting on Cloudflare

Everything is a static file except what's listed in `run_worker_first` in `wrangler.jsonc`. Cloudflare serves static files without running the Worker, so they cost nothing, use no CPU and count toward no request limit.

| Path | Served by | CPU per request |
| --- | --- | --- |
| Pages, Open Graph images, `/feed.xml` without filters, `/api/jobs`, `/api/board`, sitemap, `llms.txt`, 404s | static files | none |
| `/api/jobs/<id>` | Worker, from one of 64 shard files | about 1 ms |
| `/feed.xml?…` with filters, `/mcp` | Worker, from the static JSON | 4–7 ms; 15–25 ms on a cold instance |
| `/api/auth/get-session`, `/api/applied` | Worker, Neon over HTTP | 2–4 ms; 15–30 ms on a cold instance |
| Email sign-up, sign-in, account deletion | Worker | 100–280 ms (scrypt password hashing) |

The free plan's limits that matter, and how the site stays inside them:

- **100,000 Worker requests a day.** Only the rows above that run the Worker count. Browsers only fetch the session if they were signed in.
- **10 ms of CPU per request.** Cloudflare lets occasional requests run over. The password routes always do, by design of the hash; if they start failing with error 1102, the Workers Paid plan ($5/month) raises the limit to 30 s.
- **20,000 files per deploy.** Each job costs two files (its page and its Open Graph image): job links are plain `<a>` links, so `scripts/cloudflare-assets.mjs` deletes the job pages' client-navigation files, and `/api/jobs/<id>` comes from 64 shard files. About 3,000 files in November 2026, plus about 70 a day. The script warns at 17,000 and fails above 20,000. Before that, stop building Open Graph images for jobs older than the list window, or drop old jobs.

The Worker runs in AWS us-east-1 (`placement` in `wrangler.jsonc`), next to the Neon database, since a sign-in makes several queries in a row.

**Secrets**, set once with `npx wrangler secret put <NAME>` (or `wrangler secret bulk`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `REMOVAL_EMAIL`, `RESEND_API_KEY`, and optionally `SENTRY_DSN`. The build-time settings are in `.env.local`: `REMOVAL_EMAIL`, the Google pair, and `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` for Cloudflare Web Analytics, and `NEXT_PUBLIC_SENTRY_DSN` for browser error reports.

**Markdown for agents.** `/index.md` is the homepage as Markdown. Agents that prefer Markdown get it at `/` too: a URL rewrite rule on the hassandev.me zone (Rules → Transform Rules) rewrites `/` to `/_agents/home` when `any(lower(http.request.headers["accept"][*])[*] contains "text/markdown")`, and the Worker there parses the Accept header properly (`worker/markdown.ts`). A response header rule sets `Vary: Accept` on `/`. Browsers never send text/markdown, so they get the static homepage without running the Worker. Requests that match no file run the Worker (`not_found_handling` is `"none"`), which answers with the 404 page, or a Markdown 404 when the client prefers Markdown. So 404s, including bots probing for paths like `/wp-admin`, count toward the daily Worker requests, at under 1 ms of CPU each.

**Error reporting.** Errors go to Sentry when its DSN is set: `npx wrangler secret put SENTRY_DSN` for the Worker, and `NEXT_PUBLIC_SENTRY_DSN` in `.env.local` for the browser (read at build time). The Worker sends thrown errors and 5xx responses with one background request, and runs no extra code on requests that succeed (`worker/sentry.ts`). A request killed for running past the CPU limit (error 1102) can't report itself, so the browser reports this site's `/api/` and `/mcp` responses that come back 5xx (`src/components/ErrorReporting.tsx`). Sentry's loader script downloads the SDK only when there is something to report. Workers Logs (dashboard → Workers → onlyhiring → Logs) also list those requests, with outcome `exceededCpu`.

## Design direction

**One motif: the square bracket.** People on hiring subreddits mark a real job by starting the title with `[Hiring]`. That bracket is the site's only shape, and it appears in four places:

- The name, `only [hiring]`.
- The headline, which gets "tagged" by two large brackets when the page loads. This is the only animation on the page that runs without a click.
- The age of every job, shown in a bracket tag in the left gutter, like `[3h]`.
- Selected filters, which get bracketed like a post title.

**Colour.** One pair, each colour with one meaning. Mint is what we kept (the masthead, selected filters, the apply panel). Pink is what we flagged: scam warnings, the hidden-scams note, and the footer, which reminds you to check posts before you apply. Deep green is used only for actions. Everything else is near-white ground and near-black ink, with surfaces separated by tone instead of lines or shadows. Dark mode uses the same roles in a deep green-black, and follows `prefers-color-scheme`.

**Type.** One family, [Pilcrow Rounded](https://www.fontshare.com/fonts/pilcrow-rounded) by the Indian Type Foundry, self-hosted. It is set bold, tight and lowercase for display, with regular weight for reading. There are five sizes and no more: small, body, lead, head and display.

**Layout.** The list reads like a menu: day headings with counts, job titles on the left and pay right-aligned on the same line, like prices. There are no cards, borders or shadows. On desktop, filters sit in a sticky rail. On phones, they open in a bottom sheet from a sticky search bar.

**Motion.** It answers what the visitor does: toggles, the filter sheet, bracket marks on selection. All of it respects `prefers-reduced-motion`.

The art direction was chosen with the `frontend-design` and `taste-skill` design skills. Keep new work inside these rules. Don't add a second shape, a third colour, a second typeface or decorative motion.

## Known limitations

- **Deleted posts linger until the next pipeline run.** Each run re-checks the jobs from the last 14 days and removes any whose Reddit post was deleted or removed. Older jobs aren't re-checked, so their links can go dead.
- **Pay is not converted.** Amounts stay in the post's currency. Sorting by pay groups jobs by pay type and currency instead of comparing across them.
- **Grades can be wrong.** Summaries, fields and scam scores come from a language model. The site says so and asks visitors to verify posts on Reddit.

## Legal

This project is not affiliated with, endorsed by or sponsored by Reddit, Inc. Reddit is a trademark of Reddit, Inc. Only the opening lines of each Reddit post are stored and shown; every listing links to its original post. Removal requests go to the contact shown in the site footer.

## License

The code is released under the [MIT License](LICENSE).

The typeface, Pilcrow Rounded, is not covered by MIT. It belongs to the Indian Type Foundry and is licensed under the ITF Free Font License, which allows self-hosting on your own site but not redistributing the font files. That's why the files aren't in this repo: the build fetches your own copy from [Fontshare](https://www.fontshare.com/fonts/pilcrow-rounded), and that copy is subject to the same license.
