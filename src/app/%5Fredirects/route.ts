import { API_JOBS_FILE, API_JOBS_PATH } from "@/lib/api";
import { BEST_SUBS_PATH, SUBREDDITS, subredditPath } from "@/lib/subreddits";

// out/_redirects: Cloudflare's redirect rules for the static files (a static export has no redirects() or
// rewrites()). Cloudflare reads the file and never serves it. The folder name is how Next spells a leading "_".
// Format: https://developers.cloudflare.com/workers/static-assets/redirects/

export const dynamic = "force-static";

export function GET() {
  const rules = [
    // The job list can't be built at its own URL (see API_JOBS_FILE). 200 serves the file without redirecting.
    `${API_JOBS_PATH} ${API_JOBS_FILE} 200`,
    // The bare /r goes to the guide that lists every subreddit page. Temporary, in case /r gets a page of its own.
    `/r ${BEST_SUBS_PATH} 302`,
    // Reddit's own spelling, like /r/gameDevClassifieds, goes to the lowercase URL the page is built at.
    ...SUBREDDITS.filter((s) => s.name !== s.slug).map((s) => `/r/${s.name} ${subredditPath(s.name)} 308`),
  ];
  return new Response(`${rules.join("\n")}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
