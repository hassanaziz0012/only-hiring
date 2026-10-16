# Only Hiring

A job board for Reddit's hiring subreddits, minus the noise.

About three in four posts on subreddits like r/forhire, r/slavelabour or r/DesignJobs are people advertising their own services, discussion or spam. This site lists only the posts where someone is actually hiring. Each job has a short summary, structured fields (pay, role, work mode, location, skills) and a link back to the original Reddit post, which is where you apply.

## How it works

```
[private pipeline (not in this repo)]
  scrape new posts → grade each post with a language model → sync to Postgres
                                                                   │ writes
                                                                   ▼
                                                          Neon Postgres, `jobs` table
                                                                   ▲ reads only
                                                                   │
[this repo, on Vercel]  Next.js reads the table server-side and renders the list
```

- **Collect.** On a schedule, the pipeline reads the newest posts from about 19 hiring subreddits. Posts tagged `[For Hire]` or `[Offer]` are skipped.
- **Grade.** A language model decides whether each post is hiring, writes a summary, extracts pay, skills and location, and gives it a scam score from 0 to 1.
- **Publish.** Only hiring posts are written to the database. Post bodies are never stored; the site shows its own summary and links to Reddit.

**The scraper and grader are not part of this repository.** A separate, private pipeline collects and grades posts on a schedule and writes them to the database. This repo is only the website, and it only ever reads from the database.

### Product rules

| Rule | Value | Where |
| --- | --- | --- |
| Jobs older than this move to a collapsed "older posts" section | 14 days | `src/lib/site.ts` |
| Jobs at or above this scam score are hidden by default | 0.6 | `src/lib/site.ts` |
| Jobs at or above this scam score show a warning | 0.4 | `src/lib/site.ts` |
| Page data refreshes | every 2 hours | `src/lib/db.ts` (`cacheLife`) |

Filtering, search and sorting run in the browser, since the dataset is small. Filters are kept in the URL, so filtered views can be shared. "Applied" marks are stored in the visitor's `localStorage`, or in their account if they sign in. Accounts are optional (email and password, or Google, via [better-auth](https://www.better-auth.com)); signing in merges the browser's marks into the account. A signed-out visitor who marks a job or opens a post on Reddit is offered an account once, then not again for 14 days after dismissing it.

## Running it locally

Requirements: Node 20+ and npm.

```bash
npm install
cp .env.example .env.local   # then set WEB_DATABASE_URL (and optionally REMOVAL_EMAIL)
npm run dev
```

`WEB_DATABASE_URL` is a Postgres connection string for a role that can only `SELECT` from the `jobs` table.

`DATABASE_URL` is a second, separate Postgres database for accounts and their applied marks; create its tables with `db/schema.sql`. `BETTER_AUTH_SECRET` signs session cookies (`openssl rand -base64 32`).

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are optional and turn on "Continue with Google". They come from an OAuth client of type "Web application" in Google Cloud Console, with `https://<your domain>/api/auth/callback/google` as an authorized redirect URI (add `http://localhost:3000/...` for local use). The button is shown only when both are set at build time.

`REMOVAL_EMAIL` is optional config: the address shown for removal requests in the footer and on the About page. It is read on the server at build time. If it's unset, the site links to this repo's issue tracker instead.

On Vercel, set these in the project's environment variables for Production and Preview.

Without a reachable database the site still builds and renders a "the job list didn't load" state, then retries every minute.

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

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
    board/                client-side filters, search, sorting, grouping
    JobItem.tsx           one job in the list
    JobDetail.tsx         the detail view
  lib/
    db.ts                 the only database code (server-only, cached)
    jobs.ts               row type, defensive parsing, expiry and scam rules
    labels.ts             human labels for enum-like columns
    format.ts             pay, date and time formatting
    applied.ts            the "applied" store: localStorage, or the account when signed in
    auth.ts               better-auth config and the accounts database (server-only)
    site.ts               site name, thresholds, removal contact
```

This app uses Next.js 16 with Cache Components enabled (`cacheComponents: true`), so caching is done with `"use cache"` and `cacheLife` rather than `export const revalidate`.

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

- **Deleted or removed Reddit posts are not detected.** The pipeline doesn't re-check whether a post still exists, so a job can stay listed with a dead link until it ages out.
- **Pay is not converted.** Amounts stay in the post's currency. Sorting by pay groups jobs by pay type and currency instead of comparing across them.
- **Grades can be wrong.** Summaries, fields and scam scores come from a language model. The site says so and asks visitors to verify posts on Reddit.

## Legal

This project is not affiliated with, endorsed by or sponsored by Reddit, Inc. Reddit is a trademark of Reddit, Inc. Reddit post bodies are not stored or shown; every listing links to its original post. Removal requests go to the contact shown in the site footer.

## License

The code is released under the [MIT License](LICENSE).

The typeface, Pilcrow Rounded, is not covered by MIT. It belongs to the Indian Type Foundry and is licensed under the ITF Free Font License, which allows self-hosting on your own site but not redistributing the font files. That's why the files aren't in this repo: the build fetches your own copy from [Fontshare](https://www.fontshare.com/fonts/pilcrow-rounded), and that copy is subject to the same license.
