import Link from "next/link";
import { SITE_NAME, SOURCE_URL } from "@/lib/site";
import { AccountNav } from "./account/AccountNav";
import { FeedbackNav } from "./FeedbackNav";
import { Wordmark } from "./Wordmark";

export function SiteHeader() {
  return (
    <header className="shell flex items-center justify-between gap-4 py-4 md:py-6">
      <Link href="/" aria-label={`${SITE_NAME}, all jobs`} className="text-lead">
        <Wordmark />
      </Link>
      <nav aria-label="Site">
        <ul className="flex items-center gap-3 text-body min-[22.5rem]:gap-5">
          <li>
            <Link href="/about" className="link">
              {/* The full label doesn't fit beside the other links on phones narrower than 360px. */}
              <span className="min-[22.5rem]:hidden">About</span>
              <span className="hidden min-[22.5rem]:inline">How it works</span>
            </Link>
          </li>
          {SOURCE_URL && (
            <li className="hidden sm:block">
              <a href={SOURCE_URL} className="link" target="_blank" rel="noopener noreferrer">
                Source
              </a>
            </li>
          )}
          <li>
            <FeedbackNav />
          </li>
          <li>
            <AccountNav />
          </li>
        </ul>
      </nav>
    </header>
  );
}
