import type { Metadata } from "next";
import { CategoryPage, categoryMetadata } from "@/components/CategoryPage";
import { REMOTE } from "@/lib/categories";

export function generateMetadata(): Promise<Metadata> {
  return categoryMetadata(REMOTE);
}

export default function RemotePage() {
  return <CategoryPage cat={REMOTE} />;
}
