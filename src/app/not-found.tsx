import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="shell pt-12 pb-32 md:pt-20">
        <h1 className="display">
          <span className="bracketed">not listed</span>
        </h1>
        <p className="mt-8 max-w-[52ch] text-lead">
          This job isn&apos;t on the board. It may have been removed, re-graded as not a job, or the link may be wrong.
        </p>
        <Link href="/" className="btn mt-10">
          See all jobs
        </Link>
      </main>
    </>
  );
}
