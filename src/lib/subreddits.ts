// The subreddits the pipeline reads, each with a hand-written profile for its page at /r/<slug>,
// plus a dated snapshot of what we found there. The snapshot comes from the pipeline's posts.json
// (reposts and crossposts counted once), because the jobs table only holds hiring posts and the
// "how much of this subreddit is hiring" figures need the rest. The live figures on each page
// (open jobs, roles, warnings) come from the jobs table instead. Refresh the snapshot by hand.

import { formatMoney } from "./format";
import { isExpired, isLikelyScam, isNsfw, scamWarningLabel, type Job } from "./jobs";
import { labelFor, ROLE_LABELS } from "./labels";

export const SUBREDDIT_SNAPSHOT_DATE = "2026-10-21";

/** The guide that ranks every subreddit here, and links to each one's page. */
export const BEST_SUBS_PATH = "/guides/best-subreddits-for-jobs";

/** Below this many open jobs a subreddit page is kept out of search: a near-empty list isn't worth a result. */
export const SUBREDDIT_INDEX_MIN_JOBS = 5;

/** A median is only quoted from at least this many posts. */
export const MIN_PAY_SAMPLE = 5;

/**
 * Posts graded from one subreddit, after posts tagged [For Hire] or [Offer] were skipped, by what the
 * grader decided they were. `warned` and `likely` count hiring posts at the warning and hiding
 * thresholds. Pay medians are over hiring posts stating a US-dollar amount of that pay type.
 */
export type SubredditSnapshot = {
  graded: number;
  hiring: number;
  discussion: number;
  forHire: number;
  spam: number;
  unpaid: number;
  other: number;
  /** Hiring posts that state a pay amount. */
  payStated: number;
  hourlyUsd: { n: number; median: number | null };
  fixedUsd: { n: number; median: number | null };
};

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
  snapshot: SubredditSnapshot;
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
    snapshot: { graded: 23, hiring: 22, discussion: 0, forHire: 1, spam: 0, unpaid: 0, other: 0, payStated: 15, hourlyUsd: { n: 7, median: 25 }, fixedUsd: { n: 3, median: 25 } },
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
    snapshot: { graded: 21, hiring: 19, discussion: 0, forHire: 0, spam: 2, unpaid: 0, other: 0, payStated: 13, hourlyUsd: { n: 6, median: 19.75 }, fixedUsd: { n: 3, median: 350 } },
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
    snapshot: { graded: 17, hiring: 11, discussion: 3, forHire: 3, spam: 0, unpaid: 0, other: 0, payStated: 9, hourlyUsd: { n: 0, median: null }, fixedUsd: { n: 0, median: null } },
  },
  {
    name: "hiringpakistan",
    group: "general",
    blurb: "Jobs in Pakistan, and remote work open to Pakistani applicants. The busiest subreddit we read.",
    about: [
      "r/hiringpakistan had more hiring posts than any other subreddit we read. They range from on-site jobs in Lahore, Karachi and Islamabad to remote freelance work for clients abroad, and use the HIRING or TASK flair.",
      "Video editing and sales roles lead, followed by customer support, marketing and scriptwriting. Pay, when it's stated, is a mix of monthly salaries in rupees and dollar rates for remote work.",
    ],
    tips: [
      "Many posts don't say whether the job is on-site or remote. Ask before you send documents or travel to an interview.",
      "Most posts want a DM, and some ask for a CV by email or WhatsApp. Share your CV, but keep your CNIC and bank details back until there's a written offer.",
      "The TASK flair is used loosely: most TASK posts we read weren't hiring at all.",
    ],
    related: ["hiring", "forhire", "slavelabour"],
    snapshot: { graded: 81, hiring: 53, discussion: 13, forHire: 1, spam: 3, unpaid: 5, other: 6, payStated: 22, hourlyUsd: { n: 2, median: 8.5 }, fixedUsd: { n: 0, median: null } },
  },
  {
    name: "RemoteJobs",
    group: "general",
    blurb: "A big remote-work community where most posts are questions and discussion, not job ads.",
    about: [
      "r/RemoteJobs is mostly a place to talk about remote work: where to look, which companies are real, how to get hired. Job ads are a small share. They're flaired Job Posts, but two in three posts with that flair we read weren't job ads at all.",
      "The real ads tend to be full-time, salaried roles at named companies, often open to US residents only, and you apply on the company's own site: customer success, IT and security, healthcare administration, operations.",
    ],
    tips: [
      "Apply through the company's careers page, not through someone who DMs you about the post.",
      "Remote often means remote within one country. Check before you apply.",
    ],
    related: ["jobbit", "hiring", "remotejs"],
    snapshot: { graded: 61, hiring: 9, discussion: 36, forHire: 6, spam: 8, unpaid: 0, other: 2, payStated: 6, hourlyUsd: { n: 1, median: 27 }, fixedUsd: { n: 0, median: null } },
  },
  {
    name: "developerjobs",
    group: "tech",
    blurb: "A developer job board where most posts are developers looking for work or asking for advice.",
    about: [
      "Despite the name, most posts on r/developerjobs aren't jobs. In the posts we read, developers offering their services outnumbered hiring posts about three to one, and career questions came next.",
      "The hiring posts are a mix of software, AI and mobile roles, from internships and fresh-graduate annotation work to senior contracts. Few of them state pay.",
    ],
    tips: [
      "Few posts state pay, so settle the rate and payment terms before any work starts.",
      "Founding-member and equity-only roles turn up here too. Treat them as unpaid unless there's a salary.",
    ],
    related: ["devjobs", "softwareengineerjobs", "remotejs"],
    snapshot: { graded: 79, hiring: 11, discussion: 24, forHire: 35, spam: 6, unpaid: 1, other: 2, payStated: 3, hourlyUsd: { n: 1, median: 60 }, fixedUsd: { n: 1, median: 500 } },
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
    snapshot: { graded: 10, hiring: 9, discussion: 0, forHire: 0, spam: 0, unpaid: 0, other: 1, payStated: 6, hourlyUsd: { n: 1, median: 150 }, fixedUsd: { n: 1, median: 120 } },
  },
  {
    name: "softwareengineerjobs",
    group: "tech",
    blurb: "Mostly career talk: fewer than one post in ten was a job. The jobs are mostly remote engineering roles.",
    about: [
      "r/softwareengineerjobs was the noisiest subreddit we read. Most posts are engineers asking about interviews, layoffs and career moves, or advertising themselves.",
      "The hiring posts are mostly remote engineering roles, several of them senior, plus paid work reviewing AI-written code. Many come from agencies and recruiters posting several roles at once, with tags like [Hiring] [Remote] in the title.",
    ],
    tips: [
      "Many posts link to a recruiter or a platform rather than the employer. Find out who the client is before you share your CV.",
      "AI code-review work is often paid per task. Ask how tasks are approved and paid before you put hours in.",
    ],
    related: ["developerjobs", "remotepython", "MachineLearningJobs"],
    snapshot: { graded: 147, hiring: 14, discussion: 90, forHire: 30, spam: 11, unpaid: 1, other: 1, payStated: 6, hourlyUsd: { n: 1, median: 65 }, fixedUsd: { n: 0, median: null } },
  },
  {
    name: "remotepython",
    group: "tech",
    blurb: "A small board of remote Python roles, many of them AI coding and training contracts.",
    about: [
      "r/remotepython is small: a handful of posts a week, about half of them hiring. Most of the rest are developers offering their own services.",
      "The hiring posts are remote Python contracts, often for AI companies: writing and checking code to train models, backend and DevOps work. When pay is stated, it's usually a high hourly rate or a monthly retainer.",
    ],
    tips: [
      "Some AI training posts ask for coding-contest rankings or a skills test. Find out whether the test is paid before you start.",
      "Check the country list. Several remote posts are open to certain countries only.",
    ],
    related: ["PythonJobs", "remotejs", "softwareengineerjobs"],
    snapshot: { graded: 15, hiring: 7, discussion: 1, forHire: 5, spam: 1, unpaid: 0, other: 1, payStated: 5, hourlyUsd: { n: 2, median: 86.25 }, fixedUsd: { n: 0, median: null } },
  },
  {
    name: "PythonJobs",
    group: "tech",
    blurb: "A Python board where developers looking for work outnumber hiring posts two to one.",
    about: [
      "r/PythonJobs gets few hiring posts. Most posts we read were developers advertising themselves.",
      "The hiring posts we saw were for senior Python developers: one salaried role, and contract work evaluating AI-written code.",
    ],
    tips: [
      "Hiring posts are rare here, so follow r/remotepython and r/developerjobs too.",
      "One post we read had been copied across several subreddits, and a commenter flagged it. Search for a sentence from a post before you apply.",
    ],
    related: ["remotepython", "developerjobs", "devjobs"],
    snapshot: { graded: 11, hiring: 3, discussion: 0, forHire: 6, spam: 1, unpaid: 1, other: 0, payStated: 2, hourlyUsd: { n: 1, median: 95 }, fixedUsd: { n: 0, median: null } },
  },
  {
    name: "remotejs",
    group: "tech",
    blurb: "A remote JavaScript board where spam and self-promotion take up as much room as the jobs.",
    about: [
      "r/remotejs is for remote JavaScript and TypeScript work. In the posts we read, spam, such as job-aggregator posts and product promotion, matched the number of real hiring posts.",
      "The real posts are remote contracts: full-stack and test-automation roles, plus paid studies testing AI tools. Most state an hourly rate or a project price.",
    ],
    tips: [
      "A post listing dozens of jobs at once usually links to an aggregator, not an employer. Apply to the employer directly.",
      "AI testing studies can be genuine, but they're often for US residents over 18 only. Check who can apply first.",
    ],
    related: ["devjobs", "developerjobs", "remotepython"],
    snapshot: { graded: 24, hiring: 9, discussion: 5, forHire: 1, spam: 9, unpaid: 0, other: 0, payStated: 6, hourlyUsd: { n: 3, median: 50 }, fixedUsd: { n: 2, median: 2300 } },
  },
  {
    name: "MachineLearningJobs",
    group: "tech",
    blurb: "An ML and AI board where most posts are questions, resumes and promotion. The few jobs are well paid.",
    about: [
      "r/MachineLearningJobs is mostly about getting into machine learning: interview prep, resume reviews, and promotion for courses and job lists. About one post in six we read was hiring.",
      "The hiring posts split between salaried ML engineering roles, some on-site in the US or China, and hourly contract work training and evaluating AI models, where the stated rates are high.",
    ],
    tips: [
      "Hourly AI training work is usually paid per approved task or hour, with no guaranteed amount of work. Ask how much there really is.",
      "One post we read asked for a 996 schedule: 9am to 9pm, six days a week. Read the hours, not just the salary.",
    ],
    related: ["softwareengineerjobs", "remotepython", "developerjobs"],
    snapshot: { graded: 57, hiring: 10, discussion: 26, forHire: 10, spam: 11, unpaid: 0, other: 0, payStated: 5, hourlyUsd: { n: 3, median: 90 }, fixedUsd: { n: 0, median: null } },
  },
  {
    name: "gameDevClassifieds",
    group: "creative",
    blurb: "Paid game art, programming and audio work for indie teams, flaired by role. Mostly 2D art.",
    about: [
      "r/gameDevClassifieds is where indie game teams look for help. Flairs name both the pay and the role, like PAID - 2D Art or PAID - Programmer, and many titles carry a [PAID] tag. Unpaid and revenue-share collaborations get posted too; we don't list those.",
      "Art dominates: more than half the hiring posts we read were for 2D art and animation, then 3D modelling, programming and sound design. Most are freelance projects, but fewer than one in four states a budget, so expect to quote.",
    ],
    tips: [
      "Put a portfolio link in your first message. About half the posts we read asked for one.",
      "Quote per asset or per hour, and agree on revisions before you start.",
      "Ask when you'll be paid (per asset, per milestone or on delivery) and who owns the work.",
    ],
    related: ["HungryArtists", "DesignJobs", "forhire"],
    snapshot: { graded: 63, hiring: 42, discussion: 9, forHire: 5, spam: 1, unpaid: 5, other: 1, payStated: 10, hourlyUsd: { n: 1, median: 10 }, fixedUsd: { n: 5, median: 450 } },
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
    snapshot: { graded: 21, hiring: 20, discussion: 0, forHire: 1, spam: 0, unpaid: 0, other: 0, payStated: 16, hourlyUsd: { n: 3, median: 10 }, fixedUsd: { n: 7, median: 20 } },
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
    snapshot: { graded: 27, hiring: 19, discussion: 1, forHire: 7, spam: 0, unpaid: 0, other: 0, payStated: 17, hourlyUsd: { n: 2, median: 3 }, fixedUsd: { n: 5, median: 30 } },
  },
  {
    name: "HungryArtists",
    group: "creative",
    blurb: "Art commissions where every hiring post names a budget, usually a few hundred dollars.",
    about: [
      "r/HungryArtists is a commissions board: people post what they want drawn, and artists reply. Hiring posts are tagged [Hiring], and every one we read named a budget, which makes it one of the easiest places to see what work like yours is paid.",
      "About half the requests are character art. The rest are illustrations for books, comics and games, and personal commissions, with budgets from $40 to several thousand dollars. Some requests are NSFW; we don't list those on this page.",
    ],
    tips: [
      "Many posts ask you to comment rather than DM, often with examples. Follow the post's instructions exactly.",
      "For larger pieces, ask for part of the payment up front, and agree on sketches and revisions first.",
      "Posts flaired Position Filled are closed.",
    ],
    related: ["gameDevClassifieds", "DesignJobs", "HireaWriter"],
    snapshot: { graded: 27, hiring: 25, discussion: 0, forHire: 0, spam: 0, unpaid: 0, other: 2, payStated: 25, hourlyUsd: { n: 0, median: null }, fixedUsd: { n: 20, median: 250 } },
  },
  {
    name: "HireaWriter",
    group: "creative",
    blurb: "A small board for writing work, mostly YouTube scripts. Watch for large unpaid writing tests.",
    about: [
      "r/HireaWriter is for writing jobs. Posts are flaired Hiring (General) or Hiring (Entry Level), and many posts are writers advertising themselves, which we skip, so only a few hiring posts get through each week.",
      "Most hiring posts we read were for YouTube scripts, for history, true-crime and finance channels, paid per script. Half carried a scam warning, all for the same reason: a large unpaid writing test or rewrite.",
    ],
    tips: [
      "A short sample is normal. A 4,000-word sample, or rewriting the client's own content, is free work. Offer a shorter piece or a paid test.",
      "Per-script rates hide how long a script takes. Ask for the word count and how much research it needs before you agree.",
    ],
    related: ["forhire", "HungryArtists", "slavelabour"],
    snapshot: { graded: 6, hiring: 6, discussion: 0, forHire: 0, spam: 0, unpaid: 0, other: 0, payStated: 5, hourlyUsd: { n: 1, median: 30 }, fixedUsd: { n: 0, median: null } },
  },
  {
    name: "DesignJobs",
    group: "creative",
    blurb: "Logo, UI and web design work, usually with the budget in the title.",
    about: [
      "r/DesignJobs is for graphic and product design. Hiring posts are tagged [Hiring], and designers advertising themselves use [For Hire], which we skip. Every other post we read was a real job.",
      "Logos are the most common request, followed by UI and UX for apps, web design, and logo animation. Most posts name a budget.",
    ],
    tips: [
      "Most posts ask for a portfolio. Link to the work closest to the brief, not your whole site.",
      "Several posts we read preferred designers in India or in a European time zone. Check before you pitch.",
      "Agree on how many concepts and revisions the budget covers.",
    ],
    related: ["HungryArtists", "gameDevClassifieds", "forhire"],
    snapshot: { graded: 22, hiring: 22, discussion: 0, forHire: 0, spam: 0, unpaid: 0, other: 0, payStated: 18, hourlyUsd: { n: 3, median: 20 }, fixedUsd: { n: 10, median: 250 } },
  },
];

export const SUBREDDITS: SubredditProfile[] = PROFILES.map((p) => ({ ...p, slug: p.name.toLowerCase() }));

const BY_SLUG = new Map(SUBREDDITS.map((s) => [s.slug, s]));

/** The profile for a subreddit name in any case, or undefined if we don't profile it. */
export function subredditProfile(name: string): SubredditProfile | undefined {
  return BY_SLUG.get(name.toLowerCase());
}

export const subredditPath = (name: string) => `/r/${name.toLowerCase()}`;

/** The posts we read in the snapshot, summed over every profiled subreddit. */
export const SNAPSHOT_TOTALS = SUBREDDITS.reduce(
  (sum, s) => ({ graded: sum.graded + s.snapshot.graded, hiring: sum.hiring + s.snapshot.hiring }),
  { graded: 0, hiring: 0 },
);

/** The median pay, as "$250 per project" or "$25/hr", or null when the sample is too small. */
export function typicalPay(s: SubredditSnapshot): { text: string; n: number; hourly: boolean } | null {
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
