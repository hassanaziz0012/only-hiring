import { ImageResponse } from "next/og";
import { OG_COLORS, OG_FONTS, OG_SIZE, OgWordmark } from "@/lib/og";
import { subredditProfile, SUBREDDITS } from "@/lib/subreddits";

export const alt = "The subreddit's name: hiring posts only";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return SUBREDDITS.map((s) => ({ sub: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const profile = subredditProfile(sub);
  if (!profile) return new Response("Not found", { status: 404 });
  const name = `r/${profile.name}`;
  // As large as fits on one line: the bold face runs at about 0.42em a character, plus a margin.
  const fontSize = Math.min(150, Math.floor(1040 / (name.length * 0.46)));

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
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize, lineHeight: 1, letterSpacing: "-0.05em" }}>{name.toLowerCase()}</span>
          <span style={{ marginTop: 24, fontSize: 54, letterSpacing: "-0.03em" }}>hiring posts only, scam-checked</span>
        </div>
      </div>
    ),
    { ...size, fonts: OG_FONTS },
  );
}
