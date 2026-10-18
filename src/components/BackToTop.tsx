"use client";

import { useSyncExternalStore } from "react";

// Shown once the reader is a screen and a half down the page. Hidden during server render.

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

const getScrolledDown = () => window.scrollY > window.innerHeight * 1.5;
const getServerScrolledDown = () => false;

function scrollToTop() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

/** A fixed button in the bottom right that scrolls back to the top of a long page. */
export function BackToTop() {
  const shown = useSyncExternalStore(subscribeScroll, getScrolledDown, getServerScrolledDown);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={scrollToTop}
      inert={!shown}
      className={`btn fixed right-4 bottom-4 z-20 size-12 p-0 transition-[opacity,translate,background-color] duration-200 md:right-8 md:bottom-8 ${
        shown ? "" : "translate-y-3 opacity-0"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 20V5M5.5 11.5L12 5l6.5 6.5" strokeLinecap="square" />
      </svg>
    </button>
  );
}
