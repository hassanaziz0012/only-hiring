import { ImageResponse } from "next/og";
import { REMOTE } from "@/lib/categories";
import { OG_FONTS, OG_SIZE, OgCategoryCard } from "@/lib/og";

export const alt = "Remote jobs from Reddit, scam-checked";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgCategoryCard noun={REMOTE.noun} />, { ...size, fonts: OG_FONTS });
}
