// Landing pages for the kinds of work with steady volume: /remote and a few /roles/<slug> pages.
// Like the subreddit pages, each has hand-written copy plus live figures from the job list.
// The copy avoids exact figures, which would go stale. Only add a category that gets new posts every
// week; a page that's usually near-empty is a doorway page, not a landing page.

import { formatMoney } from "./format";
import { isExpired, isLikelyScam, isNsfw, scamWarningLabel, type Job } from "./jobs";
import { labelFor, ROLE_LABELS } from "./labels";
import { MIN_PAY_SAMPLE } from "./subreddits";

/** Below this many open jobs a category page is kept out of search. Higher than the subreddit pages' bar,
 * since a thin category page reads as a filtered copy of the homepage. */
export const CATEGORY_INDEX_MIN_JOBS = 10;

export type CategoryProfile = {
  /** "remote", or the role's slug in /roles/<slug>. */
  slug: string;
  path: string;
  /** The page's subject in a sentence, e.g. "remote jobs", "design jobs". */
  noun: string;
  /** Title-cased for headings and the <title>, e.g. "Remote jobs". */
  name: string;
  /** The role_category it covers, or null for /remote. */
  role: string | null;
  /** The board, filtered to this category. */
  boardHref: string;
  /** One or two sentences: the lede on its page and the line in lists. */
  blurb: string;
  /** What these posts look like on Reddit. */
  about: string[];
  /** Advice specific to applying for this kind of work. */
  tips: string[];
};

const role = (slug: string, key: string, p: Pick<CategoryProfile, "noun" | "name" | "blurb" | "about" | "tips">): CategoryProfile => ({
  slug,
  path: `/roles/${slug}`,
  role: key,
  boardHref: `/?role=${key}`,
  ...p,
});

export const REMOTE: CategoryProfile = {
  slug: "remote",
  path: "/remote",
  role: null,
  boardHref: "/?mode=remote",
  noun: "remote jobs",
  name: "Remote jobs",
  blurb:
    "Remote hiring posts from every job subreddit we read, with who can apply: worldwide, or only from certain countries.",
  about: [
    "Remote work is the biggest single kind of job on Reddit's job subreddits, and it comes from everywhere: tech boards like r/RemoteJobs and r/MachineLearningJobs, general boards like r/forhire and r/hiring, small-gig boards like r/DoneDirtCheap, and country boards like r/hiringpakistan, which posts remote roles open to Pakistani applicants.",
    "\"Remote\" rarely means \"from anywhere\". Many posts are open only to people in the US, Canada, the UK or the EU, and only a minority say outright that anyone can apply. Many don't say at all. Our grader reads the post for this and labels each job worldwide, restricted to named countries, or not stated.",
    "The work itself is mixed: software and data jobs, AI training and annotation work, sales and outreach, video editing, design and virtual assistants. When a post names pay, it's most often an hourly rate, then monthly; plenty name no amount at all.",
  ],
  tips: [
    "Check who can apply before anything else. A post open to US residents only is often clear about it in the body, not the title.",
    "If a remote post gives no location rules, ask before you do any work. Some only reveal a country limit once you've done a test.",
    "Pay in a currency you can actually receive. Ask how they pay (bank transfer, PayPal, Wise) before you start, not after the first invoice.",
    "Be wary of remote jobs paying well for very little: chatting, liking posts, or \"reviewing\" products. It's a common scam pattern.",
  ],
};

export const ROLES: CategoryProfile[] = [
  role("software-engineering", "software_engineering", {
    noun: "software engineering jobs",
    name: "Software engineering jobs",
    blurb:
      "Developer jobs from r/developerjobs, r/softwareengineerjobs, r/PythonJobs and other tech subreddits, with the [For Hire] posts taken out.",
    about: [
      "Most software jobs on Reddit come from a handful of tech subreddits: r/developerjobs and r/softwareengineerjobs above all, then r/PythonJobs, r/devjobs, r/remotejs and r/MachineLearningJobs. Developers offering their services outnumber the hiring posts on most of them, which is why a hiring-only list helps here more than anywhere.",
      "The mix is closer to a real job board than other kinds of work on Reddit. There are full-time salaried roles, many of them senior, alongside contracts, internships and short freelance builds. Python is the most asked-for language by a distance, followed by TypeScript, Node.js, React, Go and Java.",
      "Software posts also carry scam warnings more often than art or design posts do. The usual reasons: a vague brief with no company named, pay that's far above the going rate for the work, or a \"take-home\" that's really the product.",
    ],
    tips: [
      "Look for a company name and a careers page. A real employer usually has one, and a role you can't find anywhere but Reddit deserves a closer look.",
      "A short take-home test is normal. A multi-day build, or one that looks like a feature of their product, should be paid.",
      "Equity-only and revenue-share offers turn up here. Treat them as a side project, not a job, unless you know the founders.",
      "Never run code or install software a recruiter sends you before you've confirmed who they are. Fake interview \"assessments\" are a known way to steal crypto wallets and passwords.",
    ],
  }),
  role("art-illustration", "art_illustration", {
    noun: "art and illustration jobs",
    name: "Art & illustration jobs",
    blurb:
      "Paid art commissions and game art jobs from r/HungryArtists and r/gameDevClassifieds: character art, pixel art, concept art and 3D.",
    about: [
      "Almost all of Reddit's paid art work comes from two subreddits. r/HungryArtists is for commissions: someone wants a character drawn, a portrait, a book cover or a set of emotes. r/gameDevClassifieds is for indie game work: pixel art, sprites, Steam capsule art, environments and 3D models.",
      "Nearly every post is a fixed-price freelance project. On r/HungryArtists almost every post names a budget; on r/gameDevClassifieds few do, so expect to quote. Stated budgets are mostly small, from tens of dollars to a few hundred, so read the scope against the price before you reply. Character illustration, character design, pixel art and concept art are the most requested.",
      "Scam warnings are rare on these posts. The risks here are underpricing and spec work more than outright scams: \"art tests\" that are really the commission, and contests where only the winner gets paid.",
    ],
    tips: [
      "Follow the post's instructions on how to reply (many on r/HungryArtists want a comment, not a DM), and include two or three pieces in the style they asked for. A matching sample stands out.",
      "Take a deposit before you start, especially from a new account. Half up front is common for commissions.",
      "Agree on revisions and usage rights in writing: how many rounds, and whether it's for personal use or a commercial game.",
      "A paid test piece is fine. An unpaid \"test\" that's the exact asset they need is free work.",
    ],
  }),
  role("design", "design", {
    noun: "design jobs",
    name: "Design jobs",
    blurb:
      "Graphic, logo, brand and UI design jobs from r/DesignJobs and other subreddits, with the portfolio posts and [For Hire] ads taken out.",
    about: [
      "Most design jobs on Reddit come from r/DesignJobs, with more from r/hiringpakistan and small-gig boards like r/DoneDirtCheap and r/slavelabour. Designers advertising themselves post on the same boards, tagged [For Hire]; we skip those.",
      "The work is mostly short freelance projects at a fixed price, and most posts name a budget: logos and brand identities, social media graphics, packaging, brochures and print layouts, plus some UI work in Figma. A few posts are part-time or full-time roles, often for a small agency or an online shop.",
      "Pay is the thing to watch. Scam warnings are rare in design, but low budgets aren't: a full brand identity or a brochure for the price of a single graphic. Contests where only the winning design gets paid also turn up.",
    ],
    tips: [
      "Ask what's included before quoting: how many concepts, how many revisions, and which files they need (vector logo, print-ready PDF, Figma file).",
      "Skip contests and \"send us a free sample\" posts. Show existing work instead.",
      "For ongoing social media or brand work, agree a monthly rate and a number of pieces, so the scope can't quietly grow.",
    ],
  }),
];

export const CATEGORIES: CategoryProfile[] = [REMOTE, ...ROLES];

export function roleCategory(slug: string): CategoryProfile | undefined {
  return ROLES.find((r) => r.slug === slug);
}

/** The page for a job's role, if it has one. */
export function categoryForRole(roleKey: string | null): CategoryProfile | undefined {
  return roleKey ? ROLES.find((r) => r.role === roleKey) : undefined;
}

function matches(cat: CategoryProfile, job: Job): boolean {
  return cat.role ? job.roleCategory === cat.role : job.workMode === "remote";
}

const tally = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

/** What a category's page shows right now, from the job list. */
export type CategoryLive = {
  /** Listed by default on the board: posted within the expiry window, not a likely scam, not adult content. Newest first. */
  open: Job[];
  nsfw: number;
  /** Likely scams posted within the expiry window, hidden from the list. */
  hidden: number;
  warned: number;
  payStated: number;
  remote: number;
  /** Open remote jobs by who can apply. */
  worldwide: number;
  restricted: number;
  /** Subreddits with counts, most common first. */
  subs: [string, number][];
  /** Role labels with counts, most common first. */
  roles: [string, number][];
  /** Countries and regions restricted remote jobs are open to, most common first. */
  regions: [string, number][];
  /** Skills asked for, grouped case-insensitively, most common first. */
  skills: [string, number][];
  /** Median US-dollar pay over every job in the list window, for the pay type most of them state. */
  pay: { text: string; n: number; per: string } | null;
};

const PAY_PER: Record<string, [suffix: string, per: string]> = {
  hourly: ["/hr", "an hourly rate"],
  fixed_project: [" per project", "a price for the whole job"],
  monthly: ["/month", "a monthly rate"],
  yearly: ["/year", "a yearly salary"],
};

/** Median pay as site_stats.py takes it: the midpoint of each stated range, US dollars only. */
function medianPay(jobs: Job[]): CategoryLive["pay"] {
  const byType = new Map<string, number[]>();
  for (const job of jobs) {
    if (job.payCurrency !== "USD" || !job.payType || !(job.payType in PAY_PER)) continue;
    const lo = job.payMin ?? job.payMax;
    const hi = job.payMax ?? job.payMin;
    if (lo == null || hi == null) continue;
    byType.set(job.payType, [...(byType.get(job.payType) ?? []), (lo + hi) / 2]);
  }
  const [type, values] = [...byType].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!type || !values || values.length < MIN_PAY_SAMPLE) return null;
  const sorted = values.sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  const [suffix, per] = PAY_PER[type];
  return { text: `${formatMoney(median, "USD")}${suffix}`, n: sorted.length, per };
}

const TOP = 8;

export function categoryLive(jobs: Job[], cat: CategoryProfile, now: number): CategoryLive {
  const all = jobs.filter((job) => matches(cat, job) && !isLikelyScam(job));
  const recent = jobs.filter((job) => matches(cat, job) && !isExpired(job, now));
  const visible = recent.filter((job) => !isLikelyScam(job));
  const open = visible.filter((job) => !isNsfw(job));
  const remote = open.filter((job) => job.workMode === "remote");

  // Skills keep their most common spelling; the grader writes "Python" and "python" both.
  const spellings = new Map<string, string[]>();
  for (const job of open) {
    for (const skill of new Set(job.skills.map((s) => s.trim()).filter(Boolean))) {
      const key = skill.toLowerCase();
      spellings.set(key, [...(spellings.get(key) ?? []), skill]);
    }
  }
  const skills = [...spellings.values()]
    .map((names): [string, number] => [tally(names)[0][0], names.length])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return {
    open,
    nsfw: visible.length - open.length,
    hidden: recent.length - visible.length,
    warned: open.filter((job) => scamWarningLabel(job) !== null).length,
    payStated: open.filter((job) => job.payMin != null || job.payMax != null).length,
    remote: remote.length,
    worldwide: remote.filter((job) => job.remoteScope === "worldwide").length,
    restricted: remote.filter((job) => job.remoteScope === "restricted" || job.remoteRegions.length > 0).length,
    subs: tally(open.map((job) => job.subreddit)),
    roles: tally(open.map((job) => labelFor(ROLE_LABELS, job.roleCategory) ?? "Other")),
    regions: tally(remote.flatMap((job) => job.remoteRegions)).slice(0, TOP),
    skills: skills.filter(([, n]) => n > 1).slice(0, TOP),
    pay: medianPay(all),
  };
}

export function isCategoryIndexable(live: CategoryLive): boolean {
  return live.open.length >= CATEGORY_INDEX_MIN_JOBS;
}
