import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME}: Reddit job posts, minus the noise`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const bold = await readFile(join(process.cwd(), "src/app/fonts/PilcrowRounded-700.ttf"));

function Bracket({ side, height, stroke }: { side: "left" | "right"; height: number; stroke: number }) {
  return (
    <div
      style={{
        width: height * 0.28,
        height,
        borderTop: `${stroke}px solid #0a0a0a`,
        borderBottom: `${stroke}px solid #0a0a0a`,
        [side === "left" ? "borderLeft" : "borderRight"]: `${stroke}px solid #0a0a0a`,
      }}
    />
  );
}

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
          background: "#c3edce",
          color: "#0a0a0a",
          padding: "72px 80px",
          fontFamily: "Pilcrow",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 150, letterSpacing: "-0.05em", lineHeight: 1 }}>
          <span>only</span>
          <div style={{ display: "flex", alignItems: "center", marginLeft: 36 }}>
            <Bracket side="left" height={150} stroke={15} />
            <span style={{ margin: "0 20px" }}>hiring</span>
            <Bracket side="right" height={150} stroke={15} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 54, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
          <span>reddit&apos;s job posts,</span>
          <span>minus the noise.</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Pilcrow", data: bold, style: "normal", weight: 700 }] },
  );
}
