import Link from "next/link";
import { SITE_NAME, SOURCE_URL } from "@/lib/site";
import { hasRemovalContact, RemovalContact } from "./RemovalContact";
import { Wordmark } from "./Wordmark";

export function SiteFooter() {
  return (
    <footer className="bg-pink text-pink-ink">
      <div className="shell pt-16 pb-8 md:pt-24">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-12">
          <section className="md:col-span-5" aria-labelledby="footer-verify">
            <h2 id="footer-verify" className="text-lead font-bold tracking-tight">
              Check the post before you apply
            </h2>
            <p className="mt-2 max-w-[46ch]">
              Read the original post on Reddit before you reply, and never pay anyone to get a job.
            </p>
          </section>
          {hasRemovalContact() && (
            <section className="md:col-span-4" aria-labelledby="footer-removal">
              <h2 id="footer-removal" className="text-lead font-bold tracking-tight">
                Removal requests
              </h2>
              <RemovalContact
                lead="Wrote one of these posts and want it taken down?"
                className="mt-2 max-w-[40ch]"
              />
            </section>
          )}
          <nav className="md:col-span-3 md:col-start-10" aria-label="Footer">
            <ul className="space-y-2 text-lead font-bold tracking-tight">
              <li>
                <Link href="/" className="link">
                  All jobs
                </Link>
              </li>
              <li>
                <Link href="/about" className="link">
                  How it works
                </Link>
              </li>
              {SOURCE_URL && (
                <li>
                  <a href={SOURCE_URL} className="link" target="_blank" rel="noopener noreferrer">
                    Source code
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>

        <p className="mt-16 text-[clamp(3.5rem,20.6vw,19.6rem)] leading-[0.8]" aria-hidden="true">
          <Wordmark />
        </p>

        <p className="mt-8 max-w-[80ch] text-small">
          {SITE_NAME} is an independent project. It is not affiliated with, endorsed by or sponsored by Reddit, Inc.
          Reddit is a trademark of Reddit, Inc. Each listing links to its original post on Reddit.
        </p>
      </div>
    </footer>
  );
}
