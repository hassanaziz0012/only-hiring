"use client";

import type { Job } from "@/lib/jobs";

const BOARD_PATH = "/api/board";

// Loaded once per page load and kept, so coming back to the homepage shows the whole list straight away.
let loaded: Job[] | null = null;
let pending: Promise<Job[]> | null = null;

/** The full list, if it has already been fetched. */
export function loadedBoard(): Job[] | null {
  return loaded;
}

/** Fetch the full list from the CDN. A failed fetch can be retried. */
export function loadBoard(): Promise<Job[]> {
  pending ??= fetch(BOARD_PATH)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ jobs: Job[] }>;
    })
    .then((body) => (loaded = body.jobs))
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
