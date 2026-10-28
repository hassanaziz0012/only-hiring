import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { getSiteStats } from "@/lib/db";
import { OG_FONTS_WITH_REGULAR, OgWordmark } from "@/lib/og";
import { siteUrl } from "@/lib/site";
import { num, pct, SCAM_BANDS, statsDate, type Bar, type SiteStats } from "@/lib/stats";

// Everything on /stats as one tall image to post on Reddit and elsewhere, with the site's address in the
// bottom-right corner. The renderer needs a fixed height, so every row has a fixed height and the image is
// as tall as its rows add up to.

// The site's light theme. An image can't follow the viewer's colour scheme. Mirrors globals.css.
const C = {
  bg: "#f8f8f8",
  surface: "#ececec",
  line: "#dfdfdf",
  ink: "#0a0a0a",
  muted: "#565656",
  accent: "#1f6b3a",
  mint: "#c3edce",
  pink: "#f8c7c9",
  flag: "#9e1f2a",
  "scale-clean": "#1f6b3a",
  "scale-doubts": "#cfcfcf",
  "scale-warned": "#e0606b",
  "scale-likely": "#8a1823",
} as const;

// Three columns keep the image from growing taller than about twice its width.
const W = 1600;
const PAD = 72;
const GAP = 56;
const COLS = 3;
const COL = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;

const TEXT = 23;
const ROW = 47;
const LINE = 28;
const PANEL_HEAD = 3 + 24 + 40 + LINE + 20;
const PANEL_GAP = 40;
const LEAD = 72;
const SCALE = 30 + 20;
const LEGEND_ROW = 40;
const MEDIAN_ROW = 44;
const SECTION_HEAD = 104;
const TOP = 340;
const TILES = 190;
const FOOT = 170;
const CHIP = 46;
const CHIP_GAP = 10;

type Panel = { title: string; note: string; height: number; body: ReactNode };

function Value({ n, base }: { n: number; base: number }) {
  return (
    <div style={{ display: "flex" }}>
      <span style={{ fontWeight: 700 }}>{num(n)}</span>
      <span style={{ display: "flex", justifyContent: "flex-end", width: 62, color: C.muted }}>{pct(n, base)}</span>
    </div>
  );
}

function bars(list: Bar[], base: number, flagged = false): { height: number; body: ReactNode } {
  const max = Math.max(1, ...list.map((b) => b.n));
  return {
    height: list.length * ROW,
    body: list.map((b) => (
      <div key={b.label} style={{ display: "flex", flexDirection: "column", height: ROW }}>
        <div style={{ display: "flex", justifyContent: "space-between", height: LINE, lineHeight: `${LINE}px` }}>
          <span>{b.label}</span>
          <Value n={b.n} base={base} />
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 7,
            height: 8,
            width: Math.max(b.n > 0 ? 3 : 0, Math.round((b.n / max) * COL)),
            background: b.muted ? C["scale-doubts"] : flagged ? C.flag : C.accent,
          }}
        />
      </div>
    )),
  };
}

function lead(value: string, text: string): { height: number; body: ReactNode } {
  return {
    height: LEAD,
    body: (
      <div key="lead" style={{ display: "flex", alignItems: "flex-end", height: LEAD, paddingBottom: 18 }}>
        <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1 }}>{value}</span>
        <span style={{ marginLeft: 14, paddingBottom: 4 }}>{text}</span>
      </div>
    ),
  };
}

function panel(title: string, note: string, ...parts: { height: number; body: ReactNode }[]): Panel {
  return {
    title,
    note,
    height: PANEL_HEAD + parts.reduce((sum, p) => sum + p.height, 0) + PANEL_GAP,
    body: parts.map((p) => p.body),
  };
}

function scamScale(s: SiteStats): { height: number; body: ReactNode } {
  const bands = SCAM_BANDS.map((b) => ({ ...b, n: s.scam[b.key] })).filter((b) => b.n > 0);
  const room = COL - (bands.length - 1) * 2;
  return {
    height: SCALE + SCAM_BANDS.length * LEGEND_ROW,
    body: [
      <div key="scale" style={{ display: "flex", height: 30, marginBottom: 20 }}>
        {bands.map((b, i) => (
          <div
            key={b.key}
            style={{ display: "flex", width: Math.max(3, Math.round((b.n / s.hiring) * room)), marginLeft: i ? 2 : 0, background: C[b.color as keyof typeof C] }}
          />
        ))}
      </div>,
      ...SCAM_BANDS.map((b) => (
        <div key={b.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: LEGEND_ROW }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 16, height: 16, marginRight: 12, background: C[b.color as keyof typeof C] }} />
            <span>{b.label}</span>
            <span style={{ marginLeft: 8, color: C.muted, fontSize: 20 }}>({b.range})</span>
          </div>
          <Value n={s.scam[b.key]} base={s.hiring} />
        </div>
      )),
    ],
  };
}

function medians(s: SiteStats): { height: number; body: ReactNode } {
  if (s.medianPay.length === 0) return { height: 0, body: null };
  return {
    height: LINE + 10 + s.medianPay.length * MEDIAN_ROW,
    body: [
      <span key="m" style={{ color: C.muted, height: LINE, marginBottom: 10 }}>
        Median pay in US dollars:
      </span>,
      ...s.medianPay.map((m) => (
        <div
          key={m.label}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: MEDIAN_ROW, borderBottom: `2px solid ${C.line}` }}
        >
          <span>{m.label}</span>
          <div style={{ display: "flex" }}>
            <span style={{ fontWeight: 700 }}>{m.text}</span>
            <span style={{ marginLeft: 10, color: C.muted }}>from {num(m.n)}</span>
          </div>
        </div>
      )),
    ],
  };
}

/** Panels into columns, each into whichever is shortest so far, keeping their order within a column. */
function columns(panels: Panel[]): { height: number; cols: Panel[][] } {
  const cols: Panel[][] = Array.from({ length: COLS }, () => []);
  const heights = cols.map(() => 0);
  for (const p of panels) {
    const i = heights.indexOf(Math.min(...heights));
    cols[i].push(p);
    heights[i] += p.height;
  }
  return { height: Math.max(...heights), cols };
}

function PanelView({ p }: { p: Panel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: p.height, borderTop: `3px solid ${C.line}`, paddingTop: 24 }}>
      <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", height: 40, lineHeight: "40px" }}>{p.title}</span>
      <span style={{ color: C.muted, fontSize: 21, height: LINE, lineHeight: `${LINE}px`, marginBottom: 20 }}>{p.note}</span>
      {p.body}
    </div>
  );
}

function Section({ title, layout }: { title: string; layout: ReturnType<typeof columns> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 60, fontWeight: 700, letterSpacing: "-0.04em", height: SECTION_HEAD, paddingTop: 16, lineHeight: 1 }}>
        {title}
      </span>
      <div style={{ display: "flex", justifyContent: "space-between", height: layout.height }}>
        {layout.cols.map((col, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", width: COL }}>
            {col.map((p) => (
              <PanelView key={p.title} p={p} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rows the skill chips wrap into, erring on the wide side so the estimate never runs short. */
function chipRows(s: SiteStats): number {
  let rows = 1;
  let x = 0;
  for (const chip of s.skills) {
    const w = (chip.label.length + String(chip.n).length + 1) * TEXT * 0.6 + 32;
    if (x > 0 && x + w > W - PAD * 2) {
      rows++;
      x = 0;
    }
    x += w + CHIP_GAP;
  }
  return rows;
}

export async function GET() {
  const s = await getSiteStats();
  if (!s || s.read === 0) return new Response("The figures aren't available right now.", { status: 503 });

  const ofListed = `Of the ${num(s.listed)} jobs on the site`;
  const warned = s.scam.warned + s.scam.likely;

  const posts = columns([
    panel("What the posts were", `Of ${num(s.read)} posts, reposts counted once`, bars(s.postTypes, s.read)),
    panel("How the hiring posts scored", `Scam scores of ${num(s.hiring)} hiring posts`, scamScale(s)),
    panel("Red flags", `Hiring posts with each, of ${num(s.hiring)}`, bars(s.flags, s.hiring, true)),
    panel("Where the hiring posts were", `By subreddit, of ${num(s.hiring)}`, bars(s.bySubreddit, s.hiring)),
  ]);
  const jobs = columns([
    panel("Roles", ofListed, bars(s.roles, s.listed)),
    panel("Remote or on-site", ofListed, bars(s.workModes, s.listed)),
    ...(s.regions.length > 0
      ? [panel("Countries remote jobs are open to", `Of ${num(s.restrictedRemote)} open to certain countries only`, bars(s.regions, s.restrictedRemote))]
      : []),
    panel("Languages", ofListed, lead(pct(s.withLanguage, s.listed), "name a language you need"), bars(s.languages, s.listed)),
    panel("Type of work", ofListed, bars(s.employment, s.listed)),
    panel("Experience level", ofListed, bars(s.seniority, s.listed)),
    panel("Pay", ofListed, lead(pct(s.withPay, s.listed), "state a pay amount"), medians(s)),
    panel("Test tasks", ofListed, lead(pct(s.withTest, s.listed), "ask for a test task"), ...(s.withTest > 0 ? [bars(s.tests, s.withTest)] : [])),
  ]);
  const skillsHeight = s.skills.length > 0 ? PANEL_HEAD + chipRows(s) * (CHIP + CHIP_GAP) + PANEL_GAP : 0;
  const height = TOP + 48 + TILES + 24 + SECTION_HEAD + posts.height + SECTION_HEAD + jobs.height + skillsHeight + FOOT;

  const tiles = [
    { value: num(s.read), label: "posts read" },
    { value: num(s.hiring), label: `were hiring (${pct(s.hiring, s.read)})` },
    { value: num(s.listed), label: "jobs on the site" },
    { value: num(warned), label: `hiring posts got a scam warning (${pct(warned, s.hiring)})` },
  ];

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.bg, color: C.ink, fontFamily: "Pilcrow", fontSize: TEXT }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: TOP, padding: `52px ${PAD}px`, background: C.mint }}>
          <OgWordmark size={48} />
          <div style={{ display: "flex", flexDirection: "column", fontSize: 96, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 0.95 }}>
            <span>reddit&apos;s job posts,</span>
            <span>by the numbers</span>
          </div>
          <span style={{ fontSize: 28 }}>
            {`Every post we've read from ${s.subreddits} job subreddits${s.updatedAt ? `, as of ${statsDate(s.updatedAt)}` : ""}`}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: `48px ${PAD}px 0` }}>
          <div style={{ display: "flex", justifyContent: "space-between", height: TILES, marginBottom: 24 }}>
            {tiles.map((t) => (
              <div key={t.label} style={{ display: "flex", flexDirection: "column", width: (W - PAD * 2 - 16 * 3) / 4, padding: 24, background: C.surface }}>
                <span style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em" }}>{t.value}</span>
                <span style={{ marginTop: 14, lineHeight: 1.25 }}>{t.label}</span>
              </div>
            ))}
          </div>

          <Section title="every post we read" layout={posts} />
          <Section title="the jobs on the site" layout={jobs} />

          {s.skills.length > 0 && (
            <PanelView
              p={{
                title: "Skills asked for most",
                note: `Jobs naming each skill, of ${num(s.listed)}`,
                height: skillsHeight,
                body: (
                  <div style={{ display: "flex", flexWrap: "wrap" }}>
                    {s.skills.map((chip) => (
                      <div
                        key={chip.label}
                        style={{ display: "flex", alignItems: "center", height: CHIP, padding: "0 16px", marginRight: CHIP_GAP, marginBottom: CHIP_GAP, background: C.mint }}
                      >
                        <span>{chip.label}</span>
                        <span style={{ marginLeft: 8, fontWeight: 700 }}>{num(chip.n)}</span>
                      </div>
                    ))}
                  </div>
                ),
              }}
            />
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: FOOT, marginTop: "auto", padding: `0 ${PAD}px 48px`, background: C.pink }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>Only the hiring posts, scam-checked.</span>
            <span style={{ marginTop: 6 }}>Free, with nothing to sign up for.</span>
          </div>
          <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.03em" }}>{siteUrl().host}</span>
        </div>
      </div>
    ),
    { width: W, height, fonts: OG_FONTS_WITH_REGULAR },
  );
}
