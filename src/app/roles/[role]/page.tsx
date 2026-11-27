import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPage, categoryMetadata } from "@/components/CategoryPage";
import { roleCategory, ROLES } from "@/lib/categories";

export function generateStaticParams() {
  return ROLES.map((r) => ({ role: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/roles/[role]">): Promise<Metadata> {
  const cat = roleCategory((await params).role);
  if (!cat) return { title: "Role not found", robots: { index: false } };
  return categoryMetadata(cat);
}

export default async function RolePage({ params }: PageProps<"/roles/[role]">) {
  const cat = roleCategory((await params).role);
  if (!cat) notFound();
  return <CategoryPage cat={cat} />;
}
