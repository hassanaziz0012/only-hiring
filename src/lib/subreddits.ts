// The subreddits the pipeline reads, each with a hand-written profile for its page at /r/<slug>, and
// the figures behind those pages and the guides. Two sources, both live:
// - subreddit_stats: cumulative counts over every post the pipeline has graded, hiring or not,
//   written by the pipeline's sync (site_stats.py). The jobs table can't give these: it only holds
//   published hiring posts.
// - the jobs table: what's open right now (subredditLive).
// The profile copy is hand-written, so it avoids exact figures that would go stale.

import { formatMoney } from "./format";
import { isExpired, isLikelyScam, isNsfw, scamWarningLabel, type Job } from "./jobs";
import { labelFor, ROLE_LABELS } from "./labels";

/** The guide that ranks every subreddit here, and links to each one's page. */
export const BEST_SUBS_PATH = "/guides/best-subreddits-for-jobs";

/** Below this many open jobs a subreddit page is kept out of search: a near-empty list isn't worth a result. */
export const SUBREDDIT_INDEX_MIN_JOBS = 5;

/** A median is only quoted from at least this many posts. */
export const MIN_PAY_SAMPLE = 5;

/** When the pipeline started collecting posts, for "since October 2026". */
export const COLLECTED_SINCE = "October 2026";

export const FLAG_KINDS = ["vague", "lowPay", "freeWork", "highPay", "money"] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

/**
 * Every post graded from one subreddit, after posts tagged [For Hire] or [Offer] were skipped, by
 * what the grader decided they were. Reposts count once. `clean`, `warned` and `likely` count hiring
 * posts at a score of 0.2 or less, the warning threshold and the hiding threshold. `flags` counts hiring
 * posts with at least one red flag of each kind. Pay medians are over the midpoints of hiring posts
 * stating a US-dollar amount of that pay type.
 */
export type SubredditStats = {
  subreddit: string;
  graded: number;
  hiring: number;
  discussion: number;
  forHire: number;
  spam: number;
  unpaid: number;
  other: number;
  clean: number;
  warned: number;
  likely: number;
  anyFlag: number;
  flags: Record<FlagKind, number>;
  /** Hiring posts Reddit itself later removed (spam filters, suspended accounts), with and without a warning. */
  removedWarned: number;
  removedUnwarned: number;
  /** Hiring posts that state a pay amount. */
  payStated: number;
  hourlyUsd: { n: number; median: number | null };
  fixedUsd: { n: number; median: number | null };
};

/** A row of the subreddit_stats table as the driver returns it. */
export type StatsRow = Record<string, unknown>;

const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};
const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Parse a raw row. Null for a row without a subreddit, so one bad row can't break a page. */
export function parseStatsRow(r: StatsRow): SubredditStats | null {
  if (typeof r.subreddit !== "string" || r.subreddit === "") return null;
  return {
    subreddit: r.subreddit,
    graded: int(r.graded),
    hiring: int(r.hiring),
    discussion: int(r.discussion),
    forHire: int(r.for_hire),
    spam: int(r.spam),
    unpaid: int(r.unpaid),
    other: int(r.other),
    clean: int(r.clean),
    warned: int(r.warned),
    likely: int(r.likely),
    anyFlag: int(r.any_flag),
    flags: {
      vague: int(r.flag_vague),
      lowPay: int(r.flag_low_pay),
      freeWork: int(r.flag_free_work),
      highPay: int(r.flag_high_pay),
      money: int(r.flag_money),
    },
    removedWarned: int(r.removed_warned),
    removedUnwarned: int(r.removed_unwarned),
    payStated: int(r.pay_stated),
    hourlyUsd: { n: int(r.hourly_usd_n), median: numOrNull(r.hourly_usd_median) },
    fixedUsd: { n: int(r.fixed_usd_n), median: numOrNull(r.fixed_usd_median) },
  };
}

/** Stats for one subreddit, by name in any case. */
export function statsFor(all: SubredditStats[], name: string): SubredditStats | undefined {
  const slug = name.toLowerCase();
  return all.find((s) => s.subreddit.toLowerCase() === slug);
}

type Counts = Omit<SubredditStats, "subreddit" | "hourlyUsd" | "fixedUsd">;

/** Every count summed over the given subreddits. Medians don't sum, so they're left out. */
export function sumStats(all: SubredditStats[]): Counts {
  const zero: Counts = {
    graded: 0, hiring: 0, discussion: 0, forHire: 0, spam: 0, unpaid: 0, other: 0, clean: 0, warned: 0,
    likely: 0, anyFlag: 0, flags: { vague: 0, lowPay: 0, freeWork: 0, highPay: 0, money: 0 },
    removedWarned: 0, removedUnwarned: 0, payStated: 0,
  };
  return all.reduce<Counts>((sum, s) => {
    const next = { ...sum, flags: { ...sum.flags } };
    for (const key of Object.keys(zero) as (keyof Counts)[]) {
      if (key === "flags") continue;
      next[key] = sum[key] + s[key];
    }
    for (const kind of FLAG_KINDS) next.flags[kind] = sum.flags[kind] + s.flags[kind];
    return next;
  }, zero);
}

export type SubredditGroup = "general" | "tech" | "gigs" | "creative";

export type SubredditProfile = {
  /** As Reddit spells it. */
  name: string;
  /** Lowercase, for the URL. */
  slug: string;
  group: SubredditGroup;
  /** One or two sentences: the lede on its page and the line in lists. */
  blurb: string;
  /** What the subreddit is and what its hiring posts look like. */
  about: string[];
  /** Advice specific to applying here. */
  tips: string[];
  /** Names of related subreddits, each with a profile. */
  related: string[];
};

export const GROUP_LABELS: Record<SubredditGroup, string> = {
  general: "General hiring boards",
  tech: "Software and tech",
  gigs: "Small gigs and tasks",
  creative: "Creative, writing and design",
};

const PROFILES: Omit<SubredditProfile, "slug">[] = [
  {
    name: "forhire",
    group: "general",
    blurb:
      "A general freelance board for every kind of work. Most posts are people offering their services; these are the ones hiring.",
    about: [
      "r/forhire is a general marketplace: anyone can post work, and anyone can advertise their skills. Titles are tagged [Hiring] or [For Hire] with a matching flair, so the two kinds of post are easy to tell apart, and we skip the [For Hire] posts before reading anything.",
      "The hiring posts cover a bit of everything: video editing, virtual assistants, marketing and outreach, quick paid errands, and the odd audio or 3D job. Almost all of it is freelance, and most posters ask you to send them a DM.",
    ],
    tips: [
      "Most posts want a DM. Make the first message stand on its own: what you'd do, your rate, and one link to similar work.",
      "Posts here usually state a rate. If one doesn't, agree on it before you start, not after.",
    ],
    related: ["hiring", "slavelabour", "DoneDirtCheap"],
  },
  {
    name: "hiring",
    group: "general",
    blurb: "A general board much like r/forhire, with more part-time and on-site roles alongside the remote freelance work.",
    about: [
      "r/hiring works like r/forhire: titles are tagged [Hiring] or [For Hire], and we read only the hiring posts. Once the [For Hire] posts are gone, nearly everything left is a real job.",
      "The mix is broad: marketing and outreach, voice and audio work, customer support, AI data annotation and paid user testing. Unlike most job subreddits, a few posts are for on-site work in a named town, and several are open to US residents only.",
    ],
    tips: [
      "Read the location line first. Several posts we read were US-only or on-site.",
      "AI training and annotation jobs often start with a test. A short paid test is fair; an unpaid one that produces usable work isn't.",
    ],
    related: ["forhire", "jobbit", "RemoteJobs"],
  },
  {
    name: "jobbit",
    group: "general",
    blurb: "A slow board of mostly salaried tech jobs, many posted with the salary range in the title.",
    about: [
      "r/jobbit is closer to a traditional job board than most job subreddits. Posts are tagged [HIRING], many put the salary range in the title, and almost all of them send you to an application page off Reddit rather than to a DM.",
      "Most roles are full-time and salaried, and many are senior: data, software and DevOps, with some sales. It's also slow. Weeks can pass between new posts, so the list on this page is often short.",
    ],
    tips: [
      "Before you enter any details, check that the application link goes to the company's own site or a job board you know.",
      "One post we read asked applicants to complete a 48-hour build challenge, with prizes for the top three teams only. That's free work, not an interview.",
    ],
    related: ["hiring", "softwareengineerjobs", "RemoteJobs"],
  },
  {
    name: "hiringpakistan",
    group: "general",
    blurb: "Jobs in Pakistan, and remote work open to Pakistani applicants. One of the busiest subreddits we read.",
    about: [
      "r/hiringpakistan is one of the busiest subreddits we read. Its hiring posts range from on-site jobs in Lahore, Karachi and Islamabad to remote freelance work for clients abroad, and use the HIRING or TASK flair.",
      "Video editing and sales roles lead, followed by customer support, marketing and scriptwriting. Pay, when it's stated, is a mix of monthly salaries in rupees and dollar rates for remote work.",
    ],
    tips: [
      "Many posts don't say whether the job is on-site or remote. Ask before you send documents or travel to an interview.",
      "Most posts want a DM, and some ask for a CV by email or WhatsApp. Share your CV, but keep your CNIC and bank details back until there's a written offer.",
      "The TASK flair is used loosely: most TASK posts we read weren't hiring at all.",
    ],
    related: ["hiring", "forhire", "slavelabour"],
  },
  {
    name: "RemoteJobs",
    group: "general",
    blurb: "A big remote-work community where most posts are questions and discussion, not job ads.",
    about: [
      "r/RemoteJobs is mostly a place to talk about remote work: where to look, which companies are real, how to get hired. Job ads are a small share. They're flaired Job Posts, but most posts with that flair turn out not to be job ads at all.",
      "The real ads tend to be full-time, salaried roles at named companies, often open to US residents only, and you apply on the company's own site: customer success, IT and security, healthcare administration, operations.",
    ],
    tips: [
      "Apply through the company's careers page, not through someone who DMs you about the post.",
      "Remote often means remote within one country. Check before you apply.",
    ],
    related: ["jobbit", "hiring", "remotejs"],
  },
  {
    name: "developerjobs",
    group: "tech",
    blurb: "A developer job board where most posts are developers looking for work or asking for advice.",
    about: [
      "Despite the name, most posts on r/developerjobs aren't jobs. Developers offering their services outnumber the hiring posts several times over, and career questions come next.",
      "The hiring posts are a mix of software, AI and mobile roles, from internships and fresh-graduate annotation work to senior contracts. Few of them state pay.",
    ],
    tips: [
      "Few posts state pay, so settle the rate and payment terms before any work starts.",
      "Founding-member and equity-only roles turn up here too. Treat them as unpaid unless there's a salary.",
    ],
    related: ["devjobs", "softwareengineerjobs", "remotejs"],
  },
  {
    name: "devjobs",
    group: "tech",
    blurb: "A small developer board with web and software jobs from many countries, often local rather than remote.",
    about: [
      "r/devjobs is small but focused: nearly every post we read was hiring. Posts are flaired Hiring and range from freelance web builds to full-time roles.",
      "It's more international than most: the posts we read were for jobs in India, Japan and Nigeria as well as remote work, with pay in rupees, taka and dollars. Several ask you to apply by email.",
    ],
    tips: [
      "Check the currency and the location before you reply. Many roles here are local.",
      "Fixed-price app builds can be badly underpriced. Agree the scope in writing before you quote.",
    ],
    related: ["developerjobs", "remotejs", "PythonJobs"],
  },
  {
    name: "softwareengineerjobs",
    group: "tech",
    blurb: "Mostly career talk, with few actual jobs. The jobs it does have are mostly remote engineering roles.",
    about: [
      "r/softwareengineerjobs is one of the noisiest subreddits we read. Most posts are engineers asking about interviews, layoffs and career moves, or advertising themselves.",
      "The hiring posts are mostly remote engineering roles, several of them senior, plus paid work reviewing AI-written code. Many come from agencies and recruiters posting several roles at once, with tags like [Hiring] [Remote] in the title.",
    ],
    tips: [
      "Many posts link to a recruiter or a platform rather than the employer. Find out who the client is before you share your CV.",
      "AI code-review work is often paid per task. Ask how tasks are approved and paid before you put hours in.",
    ],
    related: ["developerjobs", "remotepython", "MachineLearningJobs"],
  },
  {
    name: "remotepython",
    group: "tech",
    blurb: "A small board of remote Python roles, many of them AI coding and training contracts.",
    about: [
      "r/remotepython is small: a handful of posts a week, and only some of them are hiring. Most of the rest are developers offering their own services.",
      "The hiring posts are remote Python contracts, often for AI companies: writing and checking code to train models, backend and DevOps work. When pay is stated, it's usually a high hourly rate or a monthly retainer.",
    ],
    tips: [
      "Some AI training posts ask for coding-contest rankings or a skills test. Find out whether the test is paid before you start.",
      "Check the country list. Several remote posts are open to certain countries only.",
    ],
    related: ["PythonJobs", "remotejs", "softwareengineerjobs"],
  },
  {
    name: "PythonJobs",
    group: "tech",
    blurb: "A Python board where developers looking for work outnumber the hiring posts.",
    about: [
      "r/PythonJobs gets few hiring posts. Most posts we read were developers advertising themselves.",
      "The hiring posts we saw were for senior Python developers: one salaried role, and contract work evaluating AI-written code.",
    ],
    tips: [
      "Hiring posts are rare here, so follow r/remotepython and r/developerjobs too.",
      "One post we read had been copied across several subreddits, and a commenter flagged it. Search for a sentence from a post before you apply.",
    ],
    related: ["remotepython", "developerjobs", "devjobs"],
  },
  {
    name: "remotejs",
    group: "tech",
    blurb: "A remote JavaScript board where spam and self-promotion take up a lot of room next to the jobs.",
    about: [
      "r/remotejs is for remote JavaScript and TypeScript work. Spam, such as job-aggregator posts and product promotion, turns up about as often as real hiring posts.",
      "The real posts are remote contracts: full-stack and test-automation roles, plus paid studies testing AI tools. Most state an hourly rate or a project price.",
    ],
    tips: [
      "A post listing dozens of jobs at once usually links to an aggregator, not an employer. Apply to the employer directly.",
      "AI testing studies can be genuine, but they're often for US residents over 18 only. Check who can apply first.",
    ],
    related: ["devjobs", "developerjobs", "remotepython"],
  },
  {
    name: "MachineLearningJobs",
    group: "tech",
    blurb: "An ML and AI board where most posts are questions, resumes and promotion. The few jobs are well paid.",
    about: [
      "r/MachineLearningJobs is mostly about getting into machine learning: interview prep, resume reviews, and promotion for courses and job lists. Only a small share of posts are hiring.",
      "The hiring posts split between salaried ML engineering roles, some on-site in the US or China, and hourly contract work training and evaluating AI models, where the stated rates are high.",
    ],
    tips: [
      "Hourly AI training work is usually paid per approved task or hour, with no guaranteed amount of work. Ask how much there really is.",
      "One post we read asked for a 996 schedule: 9am to 9pm, six days a week. Read the hours, not just the salary.",
    ],
    related: ["softwareengineerjobs", "remotepython", "developerjobs"],
  },
  {
    name: "gameDevClassifieds",
    group: "creative",
    blurb: "Paid game art, programming and audio work for indie teams, flaired by role. Mostly 2D art.",
    about: [
      "r/gameDevClassifieds is where indie game teams look for help. Flairs name both the pay and the role, like PAID - 2D Art or PAID - Programmer, and many titles carry a [PAID] tag. Unpaid and revenue-share collaborations get posted too; we don't list those.",
      "Art dominates: most hiring posts are for 2D art and animation, then 3D modelling, programming and sound design. Most are freelance projects, but few state a budget, so expect to quote.",
    ],
    tips: [
      "Put a portfolio link in your first message. Many posts ask for one.",
      "Quote per asset or per hour, and agree on revisions before you start.",
      "Ask when you'll be paid (per asset, per milestone or on delivery) and who owns the work.",
    ],
    related: ["HungryArtists", "DesignJobs", "forhire"],
  },
  {
    name: "slavelabour",
    group: "gigs",
    blurb: "Small paid tasks for small budgets, from a quick video edit to a voice-over. Expect low pay, not fraud.",
    about: [
      "r/slavelabour is for quick, cheap tasks. People hiring tag their posts [TASK], and people offering work tag theirs [OFFER], which we skip. Nearly every task we read was a genuine paid job.",
      "Typical tasks are short video edits, voice-overs and narration, admin errands like posting listings, and small design jobs. Budgets are low, usually tens of dollars, and posts often name PayPal as the way you'll be paid.",
    ],
    tips: [
      "For anything longer than an hour, ask for part of the payment up front, or split the task into paid stages.",
      "Some tasks ask for a free sample, like a short narration clip. Keep it short, or ask for it to be paid.",
    ],
    related: ["DoneDirtCheap", "forhire", "HungryArtists"],
  },
  {
    name: "DoneDirtCheap",
    group: "gigs",
    blurb: "Quick, cheap tasks like r/slavelabour, where the pay is often very low for the work.",
    about: [
      "r/DoneDirtCheap is a small-task board in the spirit of r/slavelabour. Posts are tagged [Task] or [Hiring], nearly all state a price, and the price is usually small.",
      "The tasks are virtual assistance, quick design and video edits, app testing and short UGC videos. The name is honest: when a post here got a warning, it was usually because the pay was far below the work.",
    ],
    tips: [
      "Work out the hourly rate before you accept. Two posts we read paid $2 and $4 an hour.",
      "Read what rights you're handing over. One post offered a small fixed fee for permanent commercial use of the work.",
    ],
    related: ["slavelabour", "forhire", "hiring"],
  },
  {
    name: "HungryArtists",
    group: "creative",
    blurb: "Art commissions where hiring posts name a budget, often a few hundred dollars.",
    about: [
      "r/HungryArtists is a commissions board: people post what they want drawn, and artists reply. Hiring posts are tagged [Hiring], and nearly all of them name a budget, which makes it one of the easiest places to see what work like yours is paid.",
      "Character art is the most common request. The rest are illustrations for books, comics and games, and personal commissions, with budgets from $40 to several thousand dollars. Some requests are NSFW; we don't list those on this page.",
    ],
    tips: [
      "Many posts ask you to comment rather than DM, often with examples. Follow the post's instructions exactly.",
      "For larger pieces, ask for part of the payment up front, and agree on sketches and revisions first.",
      "Posts flaired Position Filled are closed.",
    ],
    related: ["gameDevClassifieds", "DesignJobs", "HireaWriter"],
  },
  {
    name: "HireaWriter",
    group: "creative",
    blurb: "A small board for writing work, mostly YouTube scripts. Watch for large unpaid writing tests.",
    about: [
      "r/HireaWriter is for writing jobs. Posts are flaired Hiring (General) or Hiring (Entry Level), and many posts are writers advertising themselves, which we skip, so only a few hiring posts get through each week.",
      "Most hiring posts we read were for YouTube scripts, for history, true-crime and finance channels, paid per script. The scam warnings here have mostly been for one thing: a large unpaid writing test or rewrite.",
    ],
    tips: [
      "A short sample is normal. A 4,000-word sample, or rewriting the client's own content, is free work. Offer a shorter piece or a paid test.",
      "Per-script rates hide how long a script takes. Ask for the word count and how much research it needs before you agree.",
    ],
    related: ["forhire", "HungryArtists", "slavelabour"],
  },
  {
    name: "DesignJobs",
    group: "creative",
    blurb: "Logo, UI and web design work, usually with the budget in the title.",
    about: [
      "r/DesignJobs is for graphic and product design. Hiring posts are tagged [Hiring], and designers advertising themselves use [For Hire], which we skip. Nearly every other post is a real job.",
      "Logos are the most common request, followed by UI and UX for apps, web design, and logo animation. Most posts name a budget.",
    ],
    tips: [
      "Most posts ask for a portfolio. Link to the work closest to the brief, not your whole site.",
      "Several posts we read preferred designers in India or in a European time zone. Check before you pitch.",
      "Agree on how many concepts and revisions the budget covers.",
    ],
    related: ["HungryArtists", "gameDevClassifieds", "forhire"],
  },
];

export const SUBREDDITS: SubredditProfile[] = PROFILES.map((p) => ({ ...p, slug: p.name.toLowerCase() }));

const BY_SLUG = new Map(SUBREDDITS.map((s) => [s.slug, s]));

/** The profile for a subreddit name in any case, or undefined if we don't profile it. */
export function subredditProfile(name: string): SubredditProfile | undefined {
  return BY_SLUG.get(name.toLowerCase());
}

export const subredditPath = (name: string) => `/r/${name.toLowerCase()}`;

/** The median pay, as "$250 per project" or "$25/hr", or null when the sample is too small. */
export function typicalPay(s: SubredditStats): { text: string; n: number; hourly: boolean } | null {
  const { fixedUsd, hourlyUsd } = s;
  // Whichever pay type has more posts behind it, if either has enough.
  const hourly = hourlyUsd.n > fixedUsd.n;
  const pick = hourly ? hourlyUsd : fixedUsd;
  if (pick.n < MIN_PAY_SAMPLE || pick.median == null) return null;
  return { text: `${formatMoney(pick.median, "USD")}${hourly ? "/hr" : " per project"}`, n: pick.n, hourly };
}

/** What a subreddit's page shows right now, from the jobs table. */
export type SubredditLive = {
  /** Listed by default on the board: posted within the expiry window, not a likely scam. Newest first. */
  open: Job[];
  /** Open jobs kept off the subreddit page because they're adult content. */
  nsfw: number;
  /** Likely scams posted within the expiry window, hidden from the list. */
  hidden: number;
  /** Open jobs carrying a scam warning. */
  warned: number;
  /** Open jobs that state a pay amount. */
  payStated: number;
  remote: number;
  /** Role labels with counts, most common first. */
  roles: [string, number][];
};

export function subredditLive(jobs: Job[], name: string, now: number): SubredditLive {
  const slug = name.toLowerCase();
  const recent = jobs.filter((job) => job.subreddit.toLowerCase() === slug && !isExpired(job, now));
  const visible = recent.filter((job) => !isLikelyScam(job));
  const open = visible.filter((job) => !isNsfw(job));
  const roles = new Map<string, number>();
  for (const job of open) {
    const label = labelFor(ROLE_LABELS, job.roleCategory) ?? "Other";
    roles.set(label, (roles.get(label) ?? 0) + 1);
  }
  return {
    open,
    nsfw: visible.length - open.length,
    hidden: recent.length - visible.length,
    warned: open.filter((job) => scamWarningLabel(job) !== null).length,
    payStated: open.filter((job) => job.payMin != null || job.payMax != null).length,
    remote: open.filter((job) => job.workMode === "remote").length,
    roles: [...roles].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}

export function isSubredditIndexable(live: SubredditLive): boolean {
  return live.open.length >= SUBREDDIT_INDEX_MIN_JOBS;
}
