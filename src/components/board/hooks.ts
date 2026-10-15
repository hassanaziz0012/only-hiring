"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { filtersFromSearch, filtersToSearch, type Filters } from "./filters";

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

export function useUrlFilters(): [Filters, (next: Filters) => void] {
  const search = useSyncExternalStore(subscribeUrl, getSearch, getServerSearch);
  const filters = useMemo(() => filtersFromSearch(search), [search]);
  const setFilters = useCallback((next: Filters) => {
    const url = `${window.location.pathname}${filtersToSearch(next)}${window.location.hash}`;
    window.history.replaceState(null, "", url);
    urlListeners.forEach((listener) => listener());
  }, []);
  return [filters, setFilters];
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
