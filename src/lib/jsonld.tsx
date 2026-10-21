// Schema.org JSON-LD. Job pages are described as WebPages about a Reddit post, not as JobPostings:
// JobPosting needs a real hiringOrganization, and the posters are anonymous Redditors.

import type { Job } from "./jobs";
import { MAKER, SITE_DESCRIPTION, SITE_NAME, siteUrl } from "./site";

type Node = Record<string, unknown>;

/** Renders one or more nodes. `<` is escaped so post text can't close the script tag. */
export function JsonLd({ data }: { data: Node | Node[] }) {
  const doc = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : { "@context": "https://schema.org", ...data };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(doc).replace(/</g, "\\u003c") }} />
  );
}

const abs = (path: string) => new URL(path, siteUrl()).toString();
const WEBSITE_ID = () => abs("/#website");

/** Site-wide: the WebSite, published by the maker's Person node on hassandev.me. */
export function siteGraph(): Node[] {
  return [
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID(),
      url: abs("/"),
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": MAKER.id },
    },
    // Kept short: hassandev.me publishes the full Person node under the same @id.
    { "@type": "Person", "@id": MAKER.id, name: MAKER.name, url: MAKER.url },
  ];
}

/** Home: the list of open jobs, newest first. */
export function homeCollection(jobs: Job[]): Node {
  return {
    "@type": "CollectionPage",
    "@id": abs("/#jobs"),
    url: abs("/"),
    name: `${SITE_NAME}: Reddit job board`,
    isPartOf: { "@id": WEBSITE_ID() },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: jobs.length,
      itemListElement: jobs.map((job, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: abs(`/jobs/${job.id}`),
        name: job.jobTitle,
      })),
    },
  };
}

/** Job page: a WebPage about the Reddit post, plus its breadcrumb. */
export function jobGraph(job: Job): Node[] {
  const url = abs(`/jobs/${job.id}`);
  return [
    {
      "@type": "WebPage",
      "@id": url,
      url,
      name: job.jobTitle,
      description: job.summary,
      isPartOf: { "@id": WEBSITE_ID() },
      ...(job.postedAt ? { datePublished: job.postedAt } : {}),
      about: { "@type": "SocialMediaPosting", headline: job.redditTitle, url: job.redditUrl },
      breadcrumb: { "@id": `${url}#breadcrumb` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "All jobs", item: abs("/") },
        { "@type": "ListItem", position: 2, name: job.jobTitle, item: url },
      ],
    },
  ];
}
