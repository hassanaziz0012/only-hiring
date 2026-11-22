/** Shown when the data files are missing, as in a fresh clone of the repo. */
export function DataError() {
  return (
    <div className="shell py-16 md:py-24">
      <div className="bg-surface p-6 md:p-12">
        <h2 className="head lowercase">the job list didn&apos;t load</h2>
        <p className="mt-4 max-w-[56ch] text-lead">
          The site was built without its job data. Try again later.
        </p>
        <a href="" className="btn mt-8">
          Reload the page
        </a>
      </div>
    </div>
  );
}
