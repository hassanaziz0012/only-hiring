import { ImageResponse } from "next/og";
import { roleCategory, ROLES } from "@/lib/categories";
import { OG_FONTS, OG_SIZE, OgCategoryCard } from "@/lib/og";

export const alt = "The kind of work, from Reddit, scam-checked";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return ROLES.map((r) => ({ role: r.slug }));
}

export default async function Image({ params }: { params: Promise<{ role: string }> }) {
  const cat = roleCategory((await params).role);
  if (!cat) return new Response("Not found", { status: 404 });
  return new ImageResponse(<OgCategoryCard noun={cat.noun} />, { ...size, fonts: OG_FONTS });
}
