import Link from "next/link";
import { SITE_NAME, SOURCE_URL } from "@/lib/site";
import { STATS_PATH } from "@/lib/stats";
import { AccountNav } from "./account/AccountNav";
import { FeedbackNav } from "./FeedbackNav";
import { LogoMark } from "./LogoMark";
import { type MenuLink, MobileMenu } from "./MobileMenu";
import { Wordmark } from "./Wordmark";

const LINKS: MenuLink[] = [
  { href: "/about", label: "How it works" },
  { href: STATS_PATH, label: "Stats" },
  ...(SOURCE_URL ? [{ href: SOURCE_URL, label: "Source", external: true }] : []),
];

export function SiteHeader() {
  return (
    <header className="shell flex items-center justify-between gap-4 py-4 md:py-6">
      <Link href="/" aria-label={`${SITE_NAME}, all jobs`} className="flex items-center gap-2 text-lead">
        <LogoMark className="size-[1.3em] shrink-0" />
        <Wordmark />
      </Link>
      {/* Phones get the same links behind a menu button (MobileMenu). */}
      <nav aria-label="Site" className="hidden sm:block">
        <ul className="flex items-center gap-5 text-body">
          {LINKS.map((link) => (
            <li key={link.href}>
              {link.external ? (
                <a href={link.href} className="link tap" target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              ) : (
                <Link href={link.href} className="link tap">
                  {link.label}
                </Link>
              )}
            </li>
          ))}
          <li>
            <FeedbackNav />
          </li>
          <li>
            <AccountNav />
          </li>
        </ul>
      </nav>
      <MobileMenu links={LINKS} />
    </header>
  );
}
