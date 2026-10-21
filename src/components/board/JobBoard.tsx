"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAppliedIds } from "@/lib/applied";
import { countLabel } from "@/lib/format";
import { isExpired, isLikelyScam, type Job } from "@/lib/jobs";
import { EXPIRY_DAYS } from "@/lib/site";
import { JobItem } from "../JobItem";
import { FilterPanel } from "./FilterPanel";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  facetOptions,
  filtersFromSearch,
  groupJobs,
  isFiltered,
  matches,
  visibleByScamRule,
  type Filters,
} from "./filters";
import { useMinuteClock, useUrlFilters } from "./hooks";

// How long typing has to pause before the search is written to the URL.
const URL_WRITE_DELAY_MS = 200;

export function JobBoard({ jobs, fetchedAt }: { jobs: Job[]; fetchedAt: string }) {
  const [urlFilters, setFilters] = useUrlFilters();
  const applied = useAppliedIds();
  const clock = useMinuteClock();
  // Until hydration finishes, render against the snapshot time in UTC so the HTML matches.
  const now = clock ?? Date.parse(fetchedAt);
  const timeZone = clock == null ? "UTC" : undefined;
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The search box keeps its own state so typing never waits on the URL or the list. The list filters
  // on a deferred copy, which React can interrupt when the next keystroke arrives.
  const [query, setQuery] = useState(urlFilters.q);
  const [urlQuery, setUrlQuery] = useState(urlFilters.q);
  if (urlFilters.q !== urlQuery) {
    // The URL changed under us (hydration, back/forward, a cleared filter): show its search.
    setUrlQuery(urlFilters.q);
    setQuery(urlFilters.q);
  }
  const deferredQuery = useDeferredValue(query);
  const filters = useMemo(() => ({ ...urlFilters, q: deferredQuery }), [urlFilters, deferredQuery]);

  const writeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(writeTimer.current), []);

  const update = (patch: Partial<Filters>) => {
    window.clearTimeout(writeTimer.current);
    setFilters({ ...urlFilters, q: query, ...patch });
  };
  const clear = () => {
    window.clearTimeout(writeTimer.current);
    setQuery("");
    setFilters({ ...DEFAULT_FILTERS, sort: urlFilters.sort });
  };
  const search = (q: string) => {
    setQuery(q);
    window.clearTimeout(writeTimer.current);
    // Read the URL when the timer fires, so a filter changed in the meantime isn't undone.
    writeTimer.current = window.setTimeout(
      () => setFilters({ ...filtersFromSearch(window.location.search), q }),
      URL_WRITE_DELAY_MS,
    );
  };

  const { fresh, older } = useMemo(() => {
    const fresh: Job[] = [];
    const older: Job[] = [];
    for (const job of jobs) (isExpired(job, now) ? older : fresh).push(job);
    return { fresh, older };
  }, [jobs, now]);

  const view = useMemo(() => {
    const pool = fresh.filter((j) => visibleByScamRule(j, filters));
    const visible = pool.filter((j) => matches(j, filters, applied));
    const hiddenScams = filters.showScams ? 0 : fresh.filter((j) => isLikelyScam(j) && matches(j, filters, applied)).length;
    const olderVisible = older.filter((j) => visibleByScamRule(j, filters) && matches(j, filters, applied));
    return {
      visible,
      hiddenScams,
      olderVisible,
      totalScams: fresh.filter(isLikelyScam).length,
      appliedCount: jobs.filter((j) => applied.has(j.id)).length,
      options: {
        roles: facetOptions(pool, filters, applied, "roles"),
        modes: facetOptions(pool, filters, applied, "modes"),
        pay: facetOptions(pool, filters, applied, "pay"),
      },
    };
  }, [jobs, fresh, older, filters, applied]);

  const groups = useMemo(() => groupJobs(view.visible, filters.sort, now, timeZone), [view.visible, filters.sort, now, timeZone]);
  const filtered = isFiltered(filters);
  const filterCount = activeFilterCount(filters);

  const panel = (
    <FilterPanel
      filters={filters}
      onChange={update}
      options={view.options}
      scamCount={view.totalScams}
      appliedCount={view.appliedCount}
    />
  );

  return (
    <>
      <div className="shell pt-10 md:pt-16" id="jobs">
        <div className="lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[19rem_minmax(0,1fr)] xl:gap-20">
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-6 max-h-[calc(100svh-3rem)] overflow-y-auto pr-2 pb-8 [scrollbar-width:thin]">
              {panel}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="sticky top-0 z-10 -mx-4 bg-ground px-4 pt-3 pb-3 md:-mx-8 md:px-8 lg:static lg:m-0 lg:p-0">
              <label className="relative block">
                <span className="sr-only">Search jobs</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="M15.5 15.5L21 21" strokeLinecap="square" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => search(e.target.value)}
                  placeholder="Search titles, skills, places, subreddits"
                  className="field min-h-14 py-3 pr-4 pl-12 text-lead"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                />
              </label>

              <div className="mt-3 flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  className="btn btn-quiet flex-1"
                  aria-haspopup="dialog"
                  onClick={() => dialogRef.current?.showModal()}
                >
                  Filters
                  {filterCount > 0 && (
                    <span className="bg-mint px-1.5 text-small text-mint-ink tabular-nums">{filterCount}</span>
                  )}
                </button>
                <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} compact />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 md:mt-8">
              <p className="text-lead" aria-live="polite" aria-atomic="true">
                <strong className="tabular-nums">{countLabel(view.visible.length, "job")}</strong>{" "}
                <span className="text-muted">
                  {filtered ? "match" : `posted in the last ${EXPIRY_DAYS} days`}
                </span>
              </p>
              <div className="flex items-center gap-5">
                {filtered && (
                  <button type="button" className="link text-body font-bold" onClick={clear}>
                    Clear filters
                  </button>
                )}
                <span className="hidden lg:block">
                  <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} />
                </span>
              </div>
            </div>
            {filters.sort === "pay" && (
              <p className="mt-2 max-w-[60ch] text-small text-muted">
                Grouped by pay type and currency, so hourly and yearly rates aren&apos;t mixed. Amounts aren&apos;t converted.
              </p>
            )}

            {view.visible.length === 0 ? (
              <EmptyState
                hasJobs={jobs.length > 0}
                olderMatches={view.olderVisible.length}
                hiddenScams={view.hiddenScams}
                onClear={clear}
                filtered={filtered}
              />
            ) : (
              <div className="mt-10 md:mt-14">
                {groups.map((group) => (
                  <section key={group.key} aria-labelledby={`g-${group.key}`} className="mt-20 first:mt-0 md:mt-28">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 id={`g-${group.key}`} className={`head ${group.lowercase ? "lowercase" : ""}`}>
                        {group.label}
                      </h2>
                      <p className="shrink-0 text-body text-muted tabular-nums">{countLabel(group.jobs.length, "job")}</p>
                    </div>
                    <div className="mt-8 space-y-12 md:mt-10 md:space-y-14">
                      {group.jobs.map((job) => (
                        <JobItem key={job.id} job={job} now={now} timeZone={timeZone} applied={applied.has(job.id)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {view.hiddenScams > 0 && view.visible.length > 0 && (
              <ScamNote count={view.hiddenScams} onShow={() => update({ showScams: true })} />
            )}
            {filters.showScams && view.totalScams > 0 && (
              <p className="mt-16 text-body">
                Likely scams are showing, marked in pink.{" "}
                <button type="button" className="link font-bold" onClick={() => update({ showScams: false })}>
                  Hide them again
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {older.length > 0 && (
        <OlderPosts jobs={view.olderVisible} total={older.length} now={now} timeZone={timeZone} applied={applied} />
      )}

      <dialog
        ref={dialogRef}
        className="sheet lg:hidden"
        aria-labelledby="filters-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="flex max-h-[88svh] flex-col">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 id="filters-title" className="text-lead font-bold">
              Filters
            </h2>
            <button type="button" className="btn btn-quiet text-small" onClick={() => dialogRef.current?.close()}>
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">{panel}</div>
          <div className="flex gap-2 bg-surface p-4">
            <button type="button" className="btn btn-quiet flex-1 bg-ground" onClick={clear} disabled={!filtered}>
              Clear
            </button>
            <button type="button" className="btn flex-[2]" onClick={() => dialogRef.current?.close()}>
              Show {countLabel(view.visible.length, "job")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function SortSelect({ value, onChange, compact = false }: { value: Filters["sort"]; onChange: (v: Filters["sort"]) => void; compact?: boolean }) {
  return (
    <label className={`flex items-center gap-2 ${compact ? "flex-1" : ""}`}>
      <span className={compact ? "sr-only" : "text-body text-muted"}>Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === "pay" ? "pay" : "newest")}
        className="field min-h-11 cursor-pointer px-3 text-body font-bold"
      >
        <option value="newest">Newest first</option>
        <option value="pay">Highest pay</option>
      </select>
    </label>
  );
}

function EmptyState({
  hasJobs,
  olderMatches,
  hiddenScams,
  onClear,
  filtered,
}: {
  hasJobs: boolean;
  olderMatches: number;
  hiddenScams: number;
  onClear: () => void;
  filtered: boolean;
}) {
  if (!hasJobs) {
    return (
      <div className="mt-10 bg-surface p-6 md:p-10">
        <h2 className="head lowercase">no jobs right now</h2>
        <p className="mt-4 max-w-[52ch]">
          The list is empty at the moment. The list refreshes every two hours, so check back later.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-10 bg-surface p-6 md:p-10">
      <h2 className="head lowercase">nothing matches</h2>
      <p className="mt-4 max-w-[56ch]">
        {filtered
          ? `No jobs from the last ${EXPIRY_DAYS} days match these filters.`
          : `No jobs were posted in the last ${EXPIRY_DAYS} days.`}
        {olderMatches > 0 && ` ${countLabel(olderMatches, "older post")} ${olderMatches === 1 ? "does" : "do"}, further down the page.`}
        {hiddenScams > 0 && ` ${countLabel(hiddenScams, "post")} hidden as likely scams also ${hiddenScams === 1 ? "matches" : "match"}.`}
      </p>
      {filtered && (
        <button type="button" className="btn mt-6" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function ScamNote({ count, onShow }: { count: number; onShow: () => void }) {
  return (
    <div className="mt-20 flex flex-col gap-3 bg-pink p-5 text-pink-ink sm:flex-row sm:items-center sm:justify-between md:p-7">
      <p className="max-w-[60ch]">
        <strong>{countLabel(count, "post")} hidden as likely scams.</strong> Our grader spotted signs like upfront fees,
        Telegram-only contact or requests to rent your account.
      </p>
      <button type="button" className="link shrink-0 self-start font-bold sm:self-auto" onClick={onShow}>
        Show {count === 1 ? "it" : "them"}
      </button>
    </div>
  );
}

function OlderPosts({
  jobs,
  total,
  now,
  timeZone,
  applied,
}: {
  jobs: Job[];
  total: number;
  now: number;
  timeZone?: string;
  applied: ReadonlySet<string>;
}) {
  return (
    <details className="group mt-28 bg-surface md:mt-36">
      <summary className="shell block py-8 md:py-12">
        <span className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <span className="head lowercase">
            older posts <span className="text-muted tabular-nums">({jobs.length === total ? total : `${jobs.length} of ${total}`})</span>
          </span>
          <span className="link text-body font-bold">
            <span className="group-open:hidden">Show older posts</span>
            <span className="hidden group-open:inline">Hide older posts</span>
          </span>
        </span>
        <span className="mt-3 block max-w-[62ch] text-body">
          Posted more than {EXPIRY_DAYS} days ago. Many of these roles are filled or out of date, so check the post on
          Reddit before you reply.
        </span>
      </summary>
      <div className="shell pb-16 md:pb-24">
        {jobs.length === 0 ? (
          <p className="text-muted">No older posts match your filters.</p>
        ) : (
          <div className="space-y-12 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[19rem_minmax(0,1fr)] xl:gap-20">
            <div className="hidden lg:block" />
            <div className="space-y-12 md:space-y-14">
              {jobs.map((job) => (
                <JobItem key={job.id} job={job} now={now} timeZone={timeZone} applied={applied.has(job.id)} headingLevel={3} />
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
