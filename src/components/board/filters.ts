// Filter state, URL encoding, matching, faceting and grouping for the job board.

import { countLabel, dayKey, dayLabel, formatPay, payRank, workModeText } from "@/lib/format";
import { isLikelyScam, type Job } from "@/lib/jobs";
import {
  EMPLOYMENT_LABELS,
  labelFor,
  PAY_TYPE_LABELS,
  ROLE_LABELS,
  SENIORITY_LABELS,
  TEST_TASK_LABELS,
  WORK_MODE_LABELS,
} from "@/lib/labels";

export type Sort = "newest" | "pay";

/** Jobs the visitor marked as applied: shown with the rest, hidden, or shown alone. */
export type AppliedFilter = "all" | "hide" | "only";

export type Filters = {
  q: string;
  roles: string[];
  levels: string[];
  modes: string[];
  regions: string[];
  pay: string[];
  languages: string[];
  tests: string[];
  hideCommission: boolean;
  hideNative: boolean;
  applied: AppliedFilter;
  showScams: boolean;
  sort: Sort;
};

/** Stands for "the post didn't say" in a facet. */
export const NONE = "none";

export const DEFAULT_FILTERS: Filters = {
  q: "",
  roles: [],
  levels: [],
  modes: [],
  regions: [],
  pay: [],
  languages: [],
  tests: [],
  hideCommission: false,
  hideNative: false,
  applied: "all",
  showScams: false,
  sort: "newest",
};

function list(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return [...new Set(raw.split(",").map((v) => v.trim()).filter(Boolean))].slice(0, 40);
}

export function filtersFromSearch(search: string): Filters {
  const params = new URLSearchParams(search);
  return {
    q: (params.get("q") ?? "").slice(0, 200),
    roles: list(params, "role"),
    levels: list(params, "level"),
    modes: list(params, "mode"),
    regions: list(params, "region"),
    pay: list(params, "pay"),
    languages: list(params, "lang"),
    tests: list(params, "test"),
    hideCommission: params.get("commission") === "hide",
    hideNative: params.get("native") === "hide",
    applied: params.get("applied") === "hide" ? "hide" : params.get("applied") === "only" ? "only" : "all",
    showScams: params.get("scams") === "show",
    sort: params.get("sort") === "pay" ? "pay" : "newest",
  };
}

export function filtersToSearch(f: Filters): string {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.roles.length) params.set("role", f.roles.join(","));
  if (f.levels.length) params.set("level", f.levels.join(","));
  if (f.modes.length) params.set("mode", f.modes.join(","));
  if (f.regions.length) params.set("region", f.regions.join(","));
  if (f.pay.length) params.set("pay", f.pay.join(","));
  if (f.languages.length) params.set("lang", f.languages.join(","));
  if (f.tests.length) params.set("test", f.tests.join(","));
  if (f.hideCommission) params.set("commission", "hide");
  if (f.hideNative) params.set("native", "hide");
  if (f.applied !== "all") params.set("applied", f.applied);
  if (f.showScams) params.set("scams", "show");
  if (f.sort !== "newest") params.set("sort", f.sort);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Number of narrowing filters in use (search, sort and the scam reveal don't count). */
export function activeFilterCount(f: Filters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    f.roles.length +
    f.levels.length +
    f.modes.length +
    f.regions.length +
    f.pay.length +
    f.languages.length +
    f.tests.length +
    (f.hideCommission ? 1 : 0) +
    (f.hideNative ? 1 : 0) +
    (f.applied !== "all" ? 1 : 0)
  );
}

export function isFiltered(f: Filters): boolean {
  return activeFilterCount(f) > 0 || f.showScams;
}

const haystacks = new WeakMap<Job, string>();

function haystack(job: Job): string {
  let h = haystacks.get(job);
  if (h === undefined) {
    h = [
      job.jobTitle,
      job.summary,
      job.skills.join(" "),
      job.location,
      job.subreddit,
      `r/${job.subreddit}`,
      job.redditTitle,
      job.flair,
      labelFor(ROLE_LABELS, job.roleCategory),
      labelFor(SENIORITY_LABELS, job.seniority),
      labelFor(EMPLOYMENT_LABELS, job.employmentType),
      workModeText(job),
      job.payRaw,
      job.payCurrency,
      job.languages.map((l) => l.language).join(" "),
      labelFor(TEST_TASK_LABELS, job.testTask),
    ]
      .filter(Boolean)
      .join(" \u0000 ")
      .toLowerCase();
    haystacks.set(job, h);
  }
  return h;
}

export type Facet = "roles" | "levels" | "modes" | "regions" | "pay" | "languages" | "tests";

const FACETS = ["roles", "levels", "modes", "regions", "pay", "languages", "tests"] as const satisfies readonly Facet[];

/** Facet value for "open worldwide" in the regions facet. */
export const WORLDWIDE = "worldwide";

/**
 * A job's values in one facet. Regions and languages can hold several; regions can also hold none
 * (not remote, or no region stated).
 */
export function facetValues(job: Job, facet: Facet): string[] {
  if (facet === "roles") return [job.roleCategory ?? NONE];
  if (facet === "levels") return [job.seniority ?? NONE];
  if (facet === "modes") return [job.workMode ?? NONE];
  if (facet === "regions") {
    if (job.workMode !== "remote") return [];
    return job.remoteScope === "worldwide" ? [WORLDWIDE] : job.remoteRegions;
  }
  if (facet === "languages") return job.languages.length ? job.languages.map((l) => l.language) : [NONE];
  if (facet === "tests") return [job.testTask ?? NONE];
  return [job.payType ?? NONE];
}

/** Does this job pass every filter (optionally ignoring one facet, for facet counts)? */
export function matches(job: Job, f: Filters, applied: ReadonlySet<string>, skip?: Facet): boolean {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length) {
    const h = haystack(job);
    if (!terms.every((t) => h.includes(t))) return false;
  }
  for (const facet of FACETS) {
    if (facet === skip) continue;
    const selected = f[facet];
    if (selected.length && !facetValues(job, facet).some((v) => selected.includes(v))) return false;
  }
  if (f.hideCommission && job.payType === "commission_only") return false;
  if (f.hideNative && job.languages.some((l) => l.level === "native")) return false;
  if (f.applied === "hide" && applied.has(job.id)) return false;
  if (f.applied === "only" && !applied.has(job.id)) return false;
  return true;
}

export function visibleByScamRule(job: Job, f: Filters): boolean {
  return f.showScams || !isLikelyScam(job);
}

export type FacetOption = { value: string; label: string; count: number };

const FACET_LABELS: Record<Facet, Record<string, string>> = {
  roles: ROLE_LABELS,
  levels: SENIORITY_LABELS,
  modes: WORK_MODE_LABELS,
  regions: { [WORLDWIDE]: "Worldwide" },
  pay: PAY_TYPE_LABELS,
  languages: {},
  tests: { paid: "Paid", unpaid: "Unpaid", pay_not_stated: "Pay not stated" },
};

/** Facets whose options are ordered by count rather than kept in their natural order. */
const BY_COUNT: ReadonlySet<Facet> = new Set(["roles", "regions", "languages"]);

const NONE_LABELS: Partial<Record<Facet, string>> = { tests: "None mentioned" };
/**
 * Options for one facet with counts that respect every other filter.
 * Roles, regions and languages are ordered by count (worldwide first); the rest keep their natural order.
 */
export function facetOptions(pool: Job[], f: Filters, applied: ReadonlySet<string>, facet: Facet): FacetOption[] {
  const counts = new Map<string, number>();
  const present = new Set<string>();
  for (const job of pool) {
    const values = facetValues(job, facet);
    const passes = matches(job, f, applied, facet);
    for (const v of values) {
      present.add(v);
      if (passes) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  const labels = FACET_LABELS[facet];
  const keys = [...Object.keys(labels), ...[...present].filter((v) => v !== NONE && !Object.hasOwn(labels, v)).sort()];
  if (facet !== "roles" && facet !== "regions") keys.push(NONE);

  const options = keys
    .filter((v) => present.has(v) || f[facet].includes(v))
    .map((value) => ({
      value,
      label: value === NONE ? (NONE_LABELS[facet] ?? "Not stated") : (labelFor(labels, value) ?? value),
      count: counts.get(value) ?? 0,
    }));

  if (BY_COUNT.has(facet)) {
    options.sort(
      (a, b) =>
        Number(b.value === WORLDWIDE) - Number(a.value === WORLDWIDE) ||
        b.count - a.count ||
        a.label.localeCompare(b.label),
    );
  }
  return options;
}

export type Group = { key: string; label: string; lowercase: boolean; jobs: Job[] };

/** Newest: one group per calendar day. Pay: one group per pay type and currency, highest first. */
export function groupJobs(jobs: Job[], sort: Sort, now: number, timeZone?: string): Group[] {
  if (sort === "newest") {
    const groups: Group[] = [];
    let current: Group | null = null;
    for (const job of jobs) {
      const key = job.postedAt ? dayKey(job.postedAt, timeZone) : "unknown";
      if (!current || current.key !== key) {
        current = {
          key,
          label: job.postedAt ? dayLabel(job.postedAt, now, timeZone) : "Date unknown",
          lowercase: true,
          jobs: [],
        };
        groups.push(current);
      }
      current.jobs.push(job);
    }
    return groups;
  }

  const byKey = new Map<string, Group>();
  const noAmount: Job[] = [];
  for (const job of jobs) {
    if (!formatPay(job).hasAmount) {
      noAmount.push(job);
      continue;
    }
    const type = job.payType ?? NONE;
    const key = `${type}|${job.payCurrency ?? ""}`;
    let group = byKey.get(key);
    if (!group) {
      const typeLabel = type === NONE ? "Pay type not stated" : (labelFor(PAY_TYPE_LABELS, type) ?? type);
      group = { key, label: job.payCurrency ? `${typeLabel}, ${job.payCurrency}` : typeLabel, lowercase: false, jobs: [] };
      byKey.set(key, group);
    }
    group.jobs.push(job);
  }
  const groups = [...byKey.values()];
  for (const g of groups) g.jobs.sort((a, b) => (payRank(b) ?? 0) - (payRank(a) ?? 0));
  groups.sort((a, b) => b.jobs.length - a.jobs.length || a.label.localeCompare(b.label));
  if (noAmount.length) groups.push({ key: "no-amount", label: "No amount listed", lowercase: false, jobs: noAmount });
  return groups;
}

export function resultSummary(n: number): string {
  return countLabel(n, "job");
}
