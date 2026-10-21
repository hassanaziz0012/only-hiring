// Figures behind the Reddit job scams guide (/guides/reddit-job-scams), built from the pipeline's
// per-subreddit stats (see lib/subreddits.ts), so they update with every sync. Cumulative over every
// post graded since collection started, reposts and crossposts counted once. Red flags are the
// grader's free-text phrases, grouped by keyword in the pipeline's site_stats.py.

import { FLAG_KINDS, sumStats, type FlagKind, type SubredditStats } from "./subreddits";

export const SCAM_GUIDE_PATH = "/guides/reddit-job-scams";

/** When the guide was first published. Its figures change with every sync. */
export const SCAM_GUIDE_PUBLISHED = "2026-10-21";

export const FLAG_KIND_LABELS: Record<FlagKind, string> = {
  vague: "Vague work, no details",
  lowPay: "Pay far below the work",
  freeWork: "Free work as a test or contest",
  highPay: "Pay far above the work",
  money: "Handling money or trading",
};

/** Subreddits with at least this many hiring posts get their own row; the rest are summed. */
const MIN_SUB_HIRING = 10;

export function scamReport(subs: SubredditStats[]) {
  const totals = sumStats(subs);
  const flagKinds = FLAG_KINDS.map((kind) => ({ kind, label: FLAG_KIND_LABELS[kind], posts: totals.flags[kind] }))
    .filter((f) => f.posts > 0)
    .sort((a, b) => b.posts - a.posts);
  const ranked = [...subs].sort((a, b) => b.hiring - a.hiring || a.subreddit.localeCompare(b.subreddit));
  const listed = ranked.filter((s) => s.hiring >= MIN_SUB_HIRING);
  const rest = ranked.filter((s) => s.hiring < MIN_SUB_HIRING && s.hiring > 0);
  const others = sumStats(rest);
  return {
    totals,
    flagKinds,
    subreddits: listed,
    others: { count: rest.length, hiring: others.hiring, warned: others.warned, likely: others.likely },
    subredditCount: subs.length,
  };
}
