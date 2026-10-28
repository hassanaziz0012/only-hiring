import { ImageResponse } from "next/og";
import { getSiteStats } from "@/lib/db";
import { OG_COLORS, OG_FONTS, OG_SIZE, OgWordmark } from "@/lib/og";
import { num, pct } from "@/lib/stats";

export const alt = "How many posts on Reddit's job subreddits are hiring";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const s = await getSiteStats();
  const lines =
    s && s.read > 0
      ? [`${num(s.read)} posts read.`, `${pct(s.hiring, s.read)} were hiring.`]
      : ["reddit's job posts,", "by the numbers."];

  return new ImageResponse(
    (
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
        <div style={{ display: "flex", flexDirection: "column", fontSize: 104, letterSpacing: "-0.05em", lineHeight: 1 }}>
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span style={{ marginTop: 28, fontSize: 44, letterSpacing: "-0.03em" }}>reddit&apos;s job posts, by the numbers</span>
        </div>
      </div>
    ),
    { ...size, fonts: OG_FONTS },
  );
}
