import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Crawlers that only collect AI training data. Job posts expire within days, so training on them sends no one
// here, and these crawlers walked every job page often enough to put the Vercel plan near its ISR read limit
// (2026-11). AI search and the assistants that fetch a page for a user (OAI-SearchBot, ChatGPT-User,
// Claude-SearchBot, Claude-User, PerplexityBot...) aren't listed, so they still match "*".
const TRAINING_CRAWLERS = ["GPTBot", "ClaudeBot", "anthropic-ai", "CCBot", "Bytespider", "meta-externalagent", "Amazonbot"];

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: TRAINING_CRAWLERS, disallow: "/" },
      // Meta AI's search crawler fetched each job page about twice a day: half the site's AI crawler traffic.
      // It can still read the homepage, lists and guides, which link to every job.
      { userAgent: "meta-webindexer", allow: "/", disallow: "/jobs/" },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
