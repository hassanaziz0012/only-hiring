/** Shown when the database can't be reached. No error details reach the page. */
export function DataError() {
  return (
    <div className="shell py-16 md:py-24">
      <div className="bg-surface p-6 md:p-12">
        <h2 className="head lowercase">the job list didn&apos;t load</h2>
        <p className="mt-4 max-w-[56ch] text-lead">
          The database didn&apos;t respond. The page tries again on its own every minute, so reload in a moment.
        </p>
        <a href="" className="btn mt-8">
          Reload the page
        </a>
      </div>
    </div>
  );
}
