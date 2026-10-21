// Figures behind the Reddit job scams guide (/guides/reddit-job-scams). A dated snapshot, not live data:
// the jobs table only holds published jobs, while these counts also need the posts that weren't hiring
// and the ones Reddit removed. Taken from the pipeline's posts.json on 21 October 2026, counting reposts
// and crossposts once. Red flags are the grader's free-text phrases, grouped by keyword.

export const SCAM_GUIDE_PATH = "/guides/reddit-job-scams";

/** When the figures were taken, and when the guide last changed in substance. */
export const SCAM_GUIDE_UPDATED = "2026-10-21";

export const SNAPSHOT = {
  /** Posts graded, after [For Hire] and [Offer] posts were skipped. */
  graded: 712,
  hiring: 314,
  forHire: 111,
  discussion: 208,
  spam: 52,
  unpaid: 12,
  other: 15,
  /** Hiring posts scoring 0.2 or less. */
  clean: 227,
  /** Hiring posts scoring at or above the warning threshold. */
  warned: 45,
  /** Hiring posts scoring at or above the hiding threshold. */
  likely: 8,
  /** Hiring posts with at least one red flag listed. */
  anyFlag: 83,
  /** Later removed by Reddit itself (spam filters, suspended accounts), with and without a warning. */
  removedByReddit: { warned: 5, unwarned: 6 },
} as const;

/** Hiring posts with at least one red flag of each kind. A post can have several kinds. */
export const FLAG_KINDS = [
  { kind: "Vague work, no details", posts: 42 },
  { kind: "Pay far below the work", posts: 29 },
  { kind: "Free work as a test or contest", posts: 10 },
  { kind: "Pay far above the work", posts: 6 },
  { kind: "Handling money or trading", posts: 4 },
] as const;

/** Subreddits with at least 10 hiring posts; the rest are summed in OTHER_SUBREDDITS. */
export const SUBREDDITS = [
  { sub: "hiringpakistan", hiring: 55, warned: 11, likely: 1 },
  { sub: "gameDevClassifieds", hiring: 42, warned: 1, likely: 0 },
  { sub: "HungryArtists", hiring: 25, warned: 1, likely: 0 },
  { sub: "DesignJobs", hiring: 22, warned: 3, likely: 1 },
  { sub: "forhire", hiring: 22, warned: 2, likely: 0 },
  { sub: "hiring", hiring: 20, warned: 3, likely: 0 },
  { sub: "slavelabour", hiring: 20, warned: 2, likely: 0 },
  { sub: "DoneDirtCheap", hiring: 19, warned: 6, likely: 0 },
  { sub: "softwareengineerjobs", hiring: 14, warned: 1, likely: 0 },
  { sub: "developerjobs", hiring: 11, warned: 1, likely: 0 },
  { sub: "jobbit", hiring: 11, warned: 2, likely: 2 },
  { sub: "MachineLearningJobs", hiring: 10, warned: 1, likely: 0 },
] as const;

export const OTHER_SUBREDDITS = { count: 6, hiring: 43, warned: 11, likely: 4 } as const;
