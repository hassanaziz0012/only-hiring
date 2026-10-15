import Link from "next/link";
import { SITE_NAME, SOURCE_URL } from "@/lib/site";
import { Wordmark } from "./Wordmark";

export function SiteHeader() {
  return (
    <header className="shell flex items-center justify-between gap-4 py-4 md:py-6">
      <Link href="/" aria-label={`${SITE_NAME}, all jobs`} className="text-lead">
        <Wordmark />
      </Link>
      <nav aria-label="Site">
        <ul className="flex items-center gap-5 text-body">
          <li>
            <Link href="/about" className="link">
              How it works
            </Link>
          </li>
          {SOURCE_URL && (
            <li>
              <a href={SOURCE_URL} className="link">
                Source
              </a>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
