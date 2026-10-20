/**
 * The site icon: a kept post, tagged in brackets. Same drawing as app/icon.svg,
 * coloured with the theme tokens so it flips to a light tile in dark mode.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <path d="M8 12h12v8h-4v24h4v8H8zM56 12H44v8h4v24h-4v8h12z" fill="var(--accent-ink)" />
      <path
        d="M25 33l5 5 9-10.5"
        fill="none"
        stroke="var(--mint)"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
