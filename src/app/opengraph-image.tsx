import { ImageResponse } from "next/og";
import { OG_COLORS, OG_FONTS, OG_SIZE, OgWordmark } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME}: Reddit job posts, minus the noise`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
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
        <OgWordmark size={150} />
        <div style={{ display: "flex", flexDirection: "column", fontSize: 54, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
          <span>reddit&apos;s job posts,</span>
          <span>minus the noise.</span>
        </div>
      </div>
    ),
    { ...size, fonts: OG_FONTS },
  );
}
