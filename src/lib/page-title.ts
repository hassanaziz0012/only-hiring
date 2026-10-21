// The <title> of a job page. Search results cut titles at about 60 characters, many posts list
// several roles, and the same role gets posted again and again, so the title is built to fit
// and to tell otherwise identical jobs apart.

import { formatPay } from "./format";
import type { Job } from "./jobs";

const MAX_LENGTH = 60;
// Long enough for any real single role, short enough to leave room for pay.
const MAX_ROLE_LENGTH = 42;

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Video Editor / Thumbnail Designer / Scriptwriter" becomes "Video Editor +2 more". */
function role(jobTitle: string): string {
  // Split on " / " only outside brackets: "Engineer (Evaluation / Debugging)" is one role.
  const roles = jobTitle.split(/ \/ (?![^(]*\))/).map((r) => r.trim()).filter(Boolean);
  let first = roles[0] ?? jobTitle;
  if (first.length > MAX_ROLE_LENGTH) {
    // Cut at a word boundary, then drop any dangling separator.
    first = `${first.slice(0, MAX_ROLE_LENGTH).replace(/\s+\S*$/, "").replace(/[\s,&(/-]+$/, "")}…`;
  }
  return roles.length > 1 ? `${first} +${roles.length - 1} more` : first;
}

/** The longest title that fits: role, pay, Remote, subreddit, dropping from the end. */
function baseTitle(job: Job): string {
  const pay = formatPay(job);
  const parts = [role(job.jobTitle), pay.hasAmount ? pay.text : null, job.workMode === "remote" ? "Remote" : null].filter(
    (p): p is string => p !== null,
  );
  const withSub = `${parts.join(", ")} (r/${job.subreddit})`;
  if (withSub.length <= MAX_LENGTH) return withSub;
  for (let n = parts.length; n > 1; n--) {
    const title = parts.slice(0, n).join(", ");
    if (title.length <= MAX_LENGTH) return title;
  }
  return parts[0];
}

/** Titles for every listed job. A title that two jobs share gets each post's date added. */
export function jobPageTitles(jobs: Job[]): Map<string, string> {
  const base = new Map(jobs.map((job) => [job.id, baseTitle(job)]));
  const uses = new Map<string, number>();
  for (const title of base.values()) uses.set(title, (uses.get(title) ?? 0) + 1);

  const titles = new Map<string, string>();
  for (const job of jobs) {
    const title = base.get(job.id)!;
    const shared = (uses.get(title) ?? 0) > 1;
    titles.set(job.id, shared && job.postedAt ? `${title}, ${DAY.format(new Date(job.postedAt))}` : title);
  }
  return titles;
}
