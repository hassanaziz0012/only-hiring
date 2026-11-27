import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AccountLayer } from "@/components/account/AccountLayer";
import { FeedbackDialog } from "@/components/FeedbackNav";
import { SiteFooter } from "@/components/SiteFooter";
import { googleSignInEnabled } from "@/lib/google-sign-in";
import { JsonLd, siteGraph } from "@/lib/jsonld";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

const pilcrow = localFont({
  src: [
    { path: "./fonts/PilcrowRounded-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/PilcrowRounded-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/PilcrowRounded-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-pilcrow",
  display: "swap",
});

// Set at build time by scripts/deploy.mjs. Without it there are no page-view counts.
const CF_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

// Aimed at "reddit job board" and "reddit hiring posts"; the slogan stays in the H1.
const HOME_TITLE = `Reddit job board: hiring posts only, scam-checked | ${SITE_NAME}`;

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: HOME_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c3edce" },
    { media: "(prefers-color-scheme: dark)", color: "#1b3826" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={pilcrow.variable}>
      <body className="flex min-h-svh flex-col">
        <a
          href="#main"
          className="sr-only-focusable fixed top-2 left-2 z-50 bg-accent px-4 py-2 font-bold text-accent-ink"
        >
          Skip to content
        </a>
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <AccountLayer googleEnabled={googleSignInEnabled()} />
        <FeedbackDialog />
        {CF_ANALYTICS_TOKEN && (
          // Cloudflare Web Analytics: cookieless page-view counts. The token is public (it's in every page).
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: CF_ANALYTICS_TOKEN })}
          />
        )}
        <JsonLd data={siteGraph()} />
      </body>
    </html>
  );
}
