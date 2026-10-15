// Pay, date and time formatting. Pure functions, used on the server and in the browser.
// A fixed locale keeps the server render and the hydrated client render identical.

import type { Job } from "./jobs";
import { PAY_TYPE_LABELS } from "./labels";

const LOCALE = "en-GB";

const PAY_UNIT_SUFFIX: Record<string, string> = {
  hourly: "/hr",
  daily: "/day",
  weekly: "/wk",
  monthly: "/mo",
  yearly: "/yr",
  fixed_project: " per project",
  per_unit: " each",
};

const NO_AMOUNT_PAY_TYPES = new Set(["commission_only", "equity_or_revenue_share"]);

export function formatMoney(amount: number, currency: string | null): string {
  const whole = Number.isInteger(amount);
  const opts: Intl.NumberFormatOptions =
    amount >= 10_000
      ? { notation: "compact", maximumFractionDigits: 1 }
      : { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 };
  if (currency) {
    try {
      return new Intl.NumberFormat("en-US", { ...opts, style: "currency", currency }).format(amount);
    } catch {
      // Not a valid ISO 4217 code: show the number and the raw code.
      return `${new Intl.NumberFormat("en-US", opts).format(amount)} ${currency}`;
    }
  }
  return new Intl.NumberFormat("en-US", opts).format(amount);
}

export type PayDisplay = {
  /** What to show on the card. */
  text: string;
  /** False when the post says nothing about pay, so the UI can quiet it down. */
  stated: boolean;
  /** True when there is a number to compare (used for pay sorting). */
  hasAmount: boolean;
};

export function formatPay(job: Job): PayDisplay {
  const { payType, payMin, payMax, payCurrency, payRaw } = job;

  if (payType && NO_AMOUNT_PAY_TYPES.has(payType)) {
    return { text: PAY_TYPE_LABELS[payType], stated: true, hasAmount: false };
  }

  if (payMin != null || payMax != null) {
    let amount: string;
    if (payMin != null && payMax != null) {
      amount =
        payMin === payMax
          ? formatMoney(payMin, payCurrency)
          : `${formatMoney(payMin, payCurrency)}–${formatMoney(payMax, payCurrency)}`;
    } else if (payMin != null) {
      amount = `from ${formatMoney(payMin, payCurrency)}`;
    } else {
      amount = `up to ${formatMoney(payMax!, payCurrency)}`;
    }
    let suffix = "";
    if (payType) suffix = PAY_UNIT_SUFFIX[payType] ?? ` (${payType})`;
    return { text: amount + suffix, stated: true, hasAmount: true };
  }

  // No number to show. Free-text pay ("depends on sessions") stays in pay_raw, shown on hover and on the detail page.
  if (payType) {
    const label = PAY_TYPE_LABELS[payType] ?? payType;
    return { text: `${label}, no amount`, stated: false, hasAmount: false };
  }
  if (payRaw) return { text: "Amount not stated", stated: false, hasAmount: false };
  return { text: "Pay not stated", stated: false, hasAmount: false };
}

/** The larger end of the pay range, for sorting within one pay type and currency. */
export function payRank(job: Job): number | null {
  return job.payMax ?? job.payMin;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/** "3 hours ago". */
export function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - Date.parse(iso));
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return plural(Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return plural(Math.floor(diff / HOUR), "hour");
  if (diff < 14 * DAY) return plural(Math.floor(diff / DAY), "day");
  if (diff < 60 * DAY) return plural(Math.floor(diff / (7 * DAY)), "week");
  if (diff < 365 * DAY) return plural(Math.floor(diff / (30 * DAY)), "month");
  return plural(Math.floor(diff / (365 * DAY)), "year");
}

/** "3h": the compact form used inside the bracket tag on each job. */
export function shortAge(iso: string, now: number): string {
  const diff = Math.max(0, now - Date.parse(iso));
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MINUTE))}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 14 * DAY) return `${Math.floor(diff / DAY)}d`;
  if (diff < 60 * DAY) return `${Math.floor(diff / (7 * DAY))}w`;
  if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}mo`;
  return `${Math.floor(diff / (365 * DAY))}y`;
}

/** "15 Oct 2026, 09:06". */
export function exactDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}

function dayParts(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Calendar-day key in the given zone, e.g. "2026-10-15". */
export function dayKey(iso: string, timeZone?: string): string {
  const { y, m, d } = dayParts(new Date(iso), timeZone);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "Today", "Yesterday", "Monday", or "12 October". */
export function dayLabel(iso: string, now: number, timeZone?: string): string {
  const a = dayParts(new Date(iso), timeZone);
  const b = dayParts(new Date(now), timeZone);
  const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Intl.DateTimeFormat(LOCALE, { weekday: "long", timeZone }).format(new Date(iso));
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    year: a.y === b.y ? undefined : "numeric",
    timeZone,
  }).format(new Date(iso));
}

export function countLabel(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
