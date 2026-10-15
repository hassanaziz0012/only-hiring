/** "only [hiring]": the name, tagged the way hiring posts tag their titles. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold lowercase tracking-[-0.04em] ${className}`}>
      only <span className="bracketed">hiring</span>
    </span>
  );
}
