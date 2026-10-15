"use client";

import Link from "next/link";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className="shell pt-16 pb-32 md:pt-24">
      <h1 className="head lowercase">this page didn&apos;t load</h1>
      <p className="mt-6 max-w-[52ch] text-lead">
        Something went wrong while building it. Try again, or go back to the full list.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <button type="button" className="btn" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className="btn btn-quiet">
          See all jobs
        </Link>
      </div>
    </main>
  );
}
