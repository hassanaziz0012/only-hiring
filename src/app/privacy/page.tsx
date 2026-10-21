import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { MAKER, removalEmail, SITE_NAME } from "@/lib/site";

const description = `What ${SITE_NAME} stores about you, who processes it, and how to delete it.`;

export const metadata: Metadata = {
  title: "Privacy",
  description,
  alternates: { canonical: "/privacy" },
  // A page-level openGraph replaces the inherited one, so the shared fields are listed again.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} privacy policy`,
    description,
    url: "/privacy",
    locale: "en_GB",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} privacy policy`, description, images: ["/opengraph-image"] },
};

// Update this when the policy's substance changes.
const UPDATED = "21 October 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-16 gap-y-4 border-t-2 border-surface-2 pt-10 lg:grid-cols-12" aria-labelledby={id}>
      <h2 id={id} className="text-lead font-bold lg:col-span-4">
        {title}
      </h2>
      <div className="max-w-[62ch] space-y-4 lg:col-span-8">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export default function PrivacyPage() {
  const email = removalEmail();
  return (
    <>
      <SiteHeader />
      <main id="main" className="shell pt-10 pb-28 md:pt-16 md:pb-40">
        <h1 className="display">privacy</h1>
        <p className="mt-8 max-w-[44ch] text-lead md:mt-10">
          You can use {SITE_NAME} without an account, and without anything that identifies you leaving your browser.
          There are no ads, no ad trackers, and nothing is sold.
        </p>
        <p className="mt-4 text-body text-muted">Last updated {UPDATED}.</p>

        <div className="mt-20 space-y-14 md:mt-28">
          <Section id="no-account" title="Without an account">
            <p>
              Jobs you mark as applied are saved in your browser&apos;s local storage, along with the date you last
              dismissed the suggestion to create an account. Neither is sent to us. Clearing your browser data removes
              them.
            </p>
          </Section>

          <Section id="analytics" title="Page views">
            <p>
              We count page views with Vercel Web Analytics. It records the page, the site that linked to it, and your
              country, browser, operating system and device type. It sets no cookies and stores no personal
              identifiers.
            </p>
          </Section>

          <Section id="account" title="If you create an account">
            <p>Accounts are optional. They keep your applied marks across devices. With one, we store:</p>
            <List>
              <li>Your name and email address, and your profile picture if you sign in with Google.</li>
              <li>
                A securely hashed password if you sign up with email, or the sign-in tokens Google issues if you use
                Google.
              </li>
              <li>The jobs you mark as applied, and when.</li>
              <li>
                Your sign-in sessions, each with the IP address and browser it came from. A cookie keeps you signed in
                for up to 60 days.
              </li>
            </List>
            <p>
              Sign-in attempts are counted per IP address for a short time to block abuse. We never send you email.
            </p>
          </Section>

          <Section id="feedback" title="Feedback">
            <p>
              When you send feedback, we store your message, the page you sent it from, the reply email if you give
              one, and a salted hash of your IP address that&apos;s only used to limit how often feedback can be sent.
              The message is also emailed to me.
            </p>
          </Section>

          <Section id="processors" title="Who handles the data">
            <List>
              <li>Vercel hosts the site and runs the page-view counts.</li>
              <li>Neon hosts the accounts database, in the US.</li>
              <li>Resend delivers feedback messages to my inbox.</li>
              <li>Google handles sign-in, if you choose it.</li>
            </List>
          </Section>

          <Section id="delete" title="Deleting your data">
            <p>
              Delete your account from the account menu. That removes your account, sessions, sign-in details and
              applied marks straight away. Feedback isn&apos;t linked to accounts.
              {email && (
                <>
                  {" "}
                  To have a feedback message removed, or for anything else about your data, email{" "}
                  <a className="link font-bold" href={`mailto:${email}?subject=Privacy%20request`}>
                    {email}
                  </a>
                  .
                </>
              )}
            </p>
          </Section>

          <Section id="posts" title="The job posts">
            <p>
              Listings come from public Reddit posts. We keep the title, the poster&apos;s username, the opening lines
              of the post and a link to it. If you wrote one and want it gone, see{" "}
              <Link href="/about" className="link font-bold">
                removal requests
              </Link>
              .
            </p>
          </Section>

          <Section id="contact" title="Contact">
            <p>
              {SITE_NAME} is run by{" "}
              <a className="link font-bold" href={MAKER.url} target="_blank" rel="noopener noreferrer">
                {MAKER.name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {email ? (
                <>
                  . Email{" "}
                  <a className="link font-bold" href={`mailto:${email}`}>
                    {email}
                  </a>
                  .
                </>
              ) : (
                "."
              )}
            </p>
          </Section>
        </div>
      </main>
    </>
  );
}
