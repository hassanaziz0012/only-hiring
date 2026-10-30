// The figures behind /stats and its share image: what every post we've read turned out to be, and what
// the listed jobs ask for. Pure, so the page and the image route build exactly the same numbers.
// Two sources, as with the guides (see lib/subreddits.ts):
// - subreddit_stats: every post the pipeline has graded, hiring or not, reposts counted once.
// - the jobs table: the hiring posts currently on the site (posts deleted from Reddit are taken down).

import { formatMoney } from "./format";
import { EMPLOYMENT_LABELS, labelFor, ROLE_LABELS, SENIORITY_LABELS, TEST_TASK_LABELS } from "./labels";
import { SCAM_HIDE_THRESHOLD, SCAM_WARN_THRESHOLD } from "./site";
import { MIN_PAY_SAMPLE } from "./subreddits";

export const STATS_PATH = "/stats";
/** The share image of everything on the page. */
export const STATS_IMAGE_PATH = "/stats/image.png";

/** One bar: a label and how many. `muted` marks the "not stated" remainder, drawn quieter. */
export type Bar = { label: string; n: number; muted?: boolean };

/** Hiring posts by scam score, worst last. The four add up to `hiring`. */
export type ScamBands = { clean: number; doubts: number; warned: number; likely: number };

export type SiteStats = {
  /** When the figures last changed (ISO), or null if unknown. */
  updatedAt: string | null;
  /** When the pipeline first published a job (ISO), or null if there are none. */
  collectingSince: string | null;
  subreddits: number;
  /** Graded posts, reposts counted once. */
  read: number;
  hiring: number;
  /** What the posts read turned out to be. Adds up to `read`. */
  postTypes: Bar[];
  scam: ScamBands;
  /** Hiring posts with at least one red flag of each kind. */
  flags: Bar[];
  /** Hiring posts Reddit itself later removed. */
  removedByReddit: number;
  /** Hiring posts by subreddit, most first. */
  bySubreddit: Bar[];
  /** Jobs on the site now. The breakdowns below are all out of this. */
  listed: number;
  roles: Bar[];
  workModes: Bar[];
  /** Restricted remote jobs, and the countries or regions they're most often open to. */
  restrictedRemote: number;
  regions: Bar[];
  withLanguage: number;
  languages: Bar[];
  employment: Bar[];
  seniority: Bar[];
  withPay: number;
  /** Median US-dollar pay by pay type, for types with enough posts. */
  medianPay: { label: string; text: string; n: number }[];
  withTest: number;
  tests: Bar[];
  skills: Bar[];
};

/** Hiring posts at or under this score count as clean. Must match SCAM_CLEAN in the pipeline's site_stats.py. */
export const SCAM_CLEAN_THRESHOLD = 0.2;

/** The scam-score bands, in order. `color` names the CSS variable (and Tailwind colour) that draws each one. */
export const SCAM_BANDS: { key: keyof ScamBands; label: string; range: string; color: string }[] = [
  { key: "clean", label: "No concerns", range: `score ${SCAM_CLEAN_THRESHOLD} or less`, color: "scale-clean" },
  { key: "doubts", label: "Minor doubts", range: `${SCAM_CLEAN_THRESHOLD} to ${SCAM_WARN_THRESHOLD}`, color: "scale-doubts" },
  { key: "warned", label: "Scam warning", range: `${SCAM_WARN_THRESHOLD} to ${SCAM_HIDE_THRESHOLD}`, color: "scale-warned" },
  { key: "likely", label: "Likely scam, hidden", range: `${SCAM_HIDE_THRESHOLD} or more`, color: "scale-likely" },
];

/** Rows of the facet query: which breakdown, the raw value ('' for none) and how many jobs. */
export type FacetRow = { facet: string; key: string; n: number };

/** Long lists are cut to this many rows, with the rest folded into "Other" where that means something. */
export const TOP_ROLES = 9;
export const TOP_SUBREDDITS = 8;
export const TOP_REGIONS = 8;
export const TOP_LANGUAGES = 5;
export const TOP_SKILLS = 12;

const WORK_MODE_BARS: Record<string, string> = {
  remote_worldwide: "Remote, open worldwide",
  remote_restricted: "Remote, certain countries only",
  remote_unstated: "Remote, region not stated",
  onsite: "On-site",
  hybrid: "Hybrid",
};

const PAY_MEDIANS: Record<string, { label: string; suffix: string }> = {
  hourly: { label: "Hourly", suffix: "/hr" },
  fixed_project: { label: "Fixed-price project", suffix: "" },
  monthly: { label: "Monthly", suffix: "/mo" },
  yearly: { label: "Yearly", suffix: "/yr" },
};

const byCount = (a: Bar, b: Bar) => b.n - a.n || a.label.localeCompare(b.label);

/** Known values in the label map's order (empty ones dropped), then any unknown value, then "Not stated". */
function ordered(rows: FacetRow[], labels: Record<string, string>, notStated = "Not stated"): Bar[] {
  const known = Object.keys(labels)
    .map((key) => ({ label: labels[key], n: rows.find((r) => r.key === key)?.n ?? 0 }))
    .filter((b) => b.n > 0);
  const unknown = rows
    .filter((r) => r.key !== "" && !Object.hasOwn(labels, r.key))
    .map((r) => ({ label: labelFor(labels, r.key)!, n: r.n }))
    .sort(byCount);
  const none = rows.find((r) => r.key === "")?.n ?? 0;
  return [...known, ...unknown, ...(none > 0 ? [{ label: notStated, n: none, muted: true }] : [])];
}

/** The biggest `top` rows, most first. With `rest`, everything past them is summed into one row of that name. */
function ranked(bars: Bar[], top: number, rest?: string): Bar[] {
  const sorted = [...bars].sort(byCount);
  const tail = sorted.slice(top).reduce((sum, b) => sum + b.n, 0);
  return [...sorted.slice(0, top), ...(rest && tail > 0 ? [{ label: rest, n: tail, muted: true }] : [])];
}

export type RawStats = {
  /** Sums over subreddit_stats. */
  totals: Record<string, number>;
  changedAt: string | null;
  subs: { subreddit: string; hiring: number }[];
  facets: FacetRow[];
  jobs: { listed: number; withLanguage: number; withPay: number; withTest: number; restrictedRemote: number };
  firstSyncedAt: string | null;
  syncedAt: string | null;
  medians: { payType: string; n: number; median: number }[];
};

export function buildSiteStats(raw: RawStats): SiteStats {
  const t = (key: string) => raw.totals[key] ?? 0;
  const facet = (name: string) => raw.facets.filter((r) => r.facet === name);
  const hiring = t("hiring");

  // "other" is a real role category, so it joins the folded tail rather than taking a slot.
  const roleRows = facet("role");
  const other = roleRows.filter((r) => r.key === "" || r.key === "other").reduce((sum, r) => sum + r.n, 0);
  const named = roleRows
    .filter((r) => r.key !== "" && r.key !== "other")
    .map((r): Bar => ({ label: labelFor(ROLE_LABELS, r.key)!, n: r.n }))
    .sort(byCount);
  const roles = named.slice(0, TOP_ROLES);
  const otherRoles = named.slice(TOP_ROLES).reduce((sum, b) => sum + b.n, other);
  if (otherRoles > 0) roles.push({ label: "Other roles", n: otherRoles, muted: true });

  const stamps = [raw.changedAt, raw.syncedAt].filter((s): s is string => s != null).map(Date.parse);

  return {
    updatedAt: stamps.length > 0 ? new Date(Math.max(...stamps)).toISOString() : null,
    collectingSince: raw.firstSyncedAt,
    subreddits: raw.subs.length,
    read: t("graded"),
    hiring,
    postTypes: [
      { label: "Hiring", n: hiring },
      // Everything that wasn't hiring is what the site filters out, so it's drawn quieter.
      { label: "Questions and discussion", n: t("discussion"), muted: true },
      { label: "Offering their services", n: t("for_hire"), muted: true },
      { label: "Spam and promotion", n: t("spam"), muted: true },
      { label: "Unpaid collaboration", n: t("unpaid"), muted: true },
      { label: "Something else", n: t("other"), muted: true },
      { label: "Clearly not hiring, not graded", n: t("prefiltered"), muted: true },
    ].filter((b) => b.n > 0),
    scam: {
      clean: t("clean"),
      doubts: Math.max(0, hiring - t("clean") - t("warned")),
      warned: t("warned") - t("likely"),
      likely: t("likely"),
    },
    flags: [
      { label: "Vague about the work", n: t("flag_vague") },
      { label: "Low pay for the work", n: t("flag_low_pay") },
      { label: "Free work: samples, tests", n: t("flag_free_work") },
      { label: "Pay that seems too high", n: t("flag_high_pay") },
      { label: "Handling money for them", n: t("flag_money") },
    ].sort(byCount),
    removedByReddit: t("removed"),
    bySubreddit: ranked(
      raw.subs.map((s) => ({ label: `r/${s.subreddit}`, n: s.hiring })),
      TOP_SUBREDDITS,
      raw.subs.length > TOP_SUBREDDITS ? `${raw.subs.length - TOP_SUBREDDITS} more subreddits` : undefined,
    ),
    listed: raw.jobs.listed,
    roles,
    workModes: ordered(facet("mode"), WORK_MODE_BARS),
    restrictedRemote: raw.jobs.restrictedRemote,
    regions: ranked(facet("region").map((r) => ({ label: r.key, n: r.n })), TOP_REGIONS),
    withLanguage: raw.jobs.withLanguage,
    languages: ranked(facet("language").map((r) => ({ label: r.key, n: r.n })), TOP_LANGUAGES),
    employment: ordered(facet("employment"), EMPLOYMENT_LABELS),
    seniority: ordered(facet("seniority"), SENIORITY_LABELS),
    withPay: raw.jobs.withPay,
    medianPay: Object.keys(PAY_MEDIANS).flatMap((type) => {
      const m = raw.medians.find((r) => r.payType === type);
      if (!m || m.n < MIN_PAY_SAMPLE) return [];
      return [{ label: PAY_MEDIANS[type].label, text: `${formatMoney(m.median, "USD")}${PAY_MEDIANS[type].suffix}`, n: m.n }];
    }),
    withTest: raw.jobs.withTest,
    tests: ordered(facet("test").filter((r) => r.key !== ""), TEST_TASK_LABELS),
    skills: ranked(facet("skill").map((r) => ({ label: r.key, n: r.n })), TOP_SKILLS),
  };
}

/** A whole-number share, "<1%" for a sliver, so a non-zero count never reads as 0%. */
export function pct(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return "0%";
  const p = (part / whole) * 100;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}

/** 1,036. A fixed locale keeps the server and client renders identical. */
export const num = (n: number) => n.toLocaleString("en-GB");

/** "28 October 2026". */
export const statsDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "October 2026". */
export const statsMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
