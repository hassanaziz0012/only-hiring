"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_FILTERS, filtersFromSearch, filtersToSearch, type Filters } from "./filters";

// The URL query string is the filter state, so a filtered view can be shared or bookmarked.
// The server always renders the unfiltered list (empty search), and the browser applies
// the URL's filters right after hydration.

const urlListeners = new Set<() => void>();

function subscribeUrl(onChange: () => void) {
  urlListeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    urlListeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const getSearch = () => window.location.search;
const getServerSearch = () => "";

function replaceSearch(search: string) {
  const url = `${window.location.pathname}${search}${window.location.hash}`;
  window.history.replaceState(null, "", url);
  urlListeners.forEach((listener) => listener());
}

export function useUrlFilters(): [Filters, (next: Filters) => void] {
  const search = useSyncExternalStore(subscribeUrl, getSearch, getServerSearch);
  const filters = useMemo(() => filtersFromSearch(search), [search]);
  const setFilters = useCallback((next: Filters) => replaceSearch(filtersToSearch(next)), []);
  return [filters, setFilters];
}

/**
 * Apply filters to the board already on screen. Next's router doesn't re-render the board for
 * a search-only change on the same page, so links to a filtered "/" from "/" use this instead.
 */
export function showFilteredBoard(next: Partial<Filters>) {
  replaceSearch(filtersToSearch({ ...DEFAULT_FILTERS, ...next }));
  document.getElementById("jobs")?.scrollIntoView();
}

// A clock that ticks once a minute. Null during server render and hydration, so the
// first client render matches the server HTML; real time takes over right after.

function subscribeClock(onChange: () => void) {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
}

const getMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const getServerMinute = (): number | null => null;

export function useMinuteClock(): number | null {
  return useSyncExternalStore<number | null>(subscribeClock, getMinute, getServerMinute);
}
