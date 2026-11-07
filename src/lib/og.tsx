// Shared pieces of the generated Open Graph images: the font, the colours and the bracket shape.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_COLORS = { mint: "#c3edce", ink: "#0a0a0a", pink: "#f8c7c9", accent: "#1f6b3a" };

// The image renderer needs TTF (it can't read WOFF2). Only these two weights are fetched as TTF.
const [bold, regular] = await Promise.all(
  [700, 400].map((weight) => readFile(join(process.cwd(), `src/app/fonts/PilcrowRounded-${weight}.ttf`))),
);

/** Bold only, so text in the Open Graph images is bold whatever its weight. */
export const OG_FONTS = [{ name: "Pilcrow", data: bold, style: "normal" as const, weight: 700 as const }];

/** Both weights, for images with body text (the stats image). */
export const OG_FONTS_WITH_REGULAR = [
  ...OG_FONTS,
  { name: "Pilcrow", data: regular, style: "normal" as const, weight: 400 as const },
];

/** One side of the square bracket from "[Hiring]" post titles. */
export function Bracket({ side, height, stroke }: { side: "left" | "right"; height: number; stroke: number }) {
  return (
    <div
      style={{
        width: height * 0.28,
        height,
        borderTop: `${stroke}px solid ${OG_COLORS.ink}`,
        borderBottom: `${stroke}px solid ${OG_COLORS.ink}`,
        [side === "left" ? "borderLeft" : "borderRight"]: `${stroke}px solid ${OG_COLORS.ink}`,
      }}
    />
  );
}

/** "only [hiring]" at the given font size. */
export function OgWordmark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: size, letterSpacing: "-0.05em", lineHeight: 1 }}>
      <span>only</span>
      <div style={{ display: "flex", alignItems: "center", marginLeft: size * 0.24 }}>
        <Bracket side="left" height={size} stroke={Math.max(3, Math.round(size * 0.1))} />
        <span style={{ margin: `0 ${Math.round(size * 0.13)}px` }}>hiring</span>
        <Bracket side="right" height={size} stroke={Math.max(3, Math.round(size * 0.1))} />
      </div>
    </div>
  );
}

/**
 * Text the bundled font can draw. It has no glyphs for most currency signs (₹, ₱) or for emoji, and the
 * renderer can't fetch a fallback at build time, so those would come out blank: currency signs become
 * the ISO code, and emoji are dropped.
 */
export function drawable(text: string, currency: string | null = null): string {
  return text
    .replace(/[^\P{Sc}$€£]/gu, currency ? `${currency} ` : "")
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Cut text to at most `max` characters at a word boundary. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s,&(/–-]+$/, "")}…`;
}

/** A category page's image (/remote, /roles/<slug>): the category, as large as fits, over the tagline. */
export function OgCategoryCard({ noun }: { noun: string }) {
  // The bold face runs at about 0.46em a character; long names wrap onto two lines instead of shrinking.
  const fontSize = noun.length > 18 ? 110 : 150;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: OG_COLORS.mint,
        color: OG_COLORS.ink,
        padding: "72px 80px",
        fontFamily: "Pilcrow",
      }}
    >
      <OgWordmark size={52} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize, lineHeight: 1, letterSpacing: "-0.05em" }}>{noun.toLowerCase()}</span>
        <span style={{ marginTop: 24, fontSize: 54, letterSpacing: "-0.03em" }}>from reddit, scam-checked</span>
      </div>
    </div>
  );
}
