/** A titled block of prose for guides and subreddit pages: the title in a narrow column beside the text on wide screens. */
export function ProseSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-16 gap-y-4 border-t-2 border-surface-2 pt-10 lg:grid-cols-12" aria-labelledby={id}>
      <h2 id={id} className="text-lead font-bold lg:col-span-4">
        {title}
      </h2>
      <div className="max-w-[62ch] min-w-0 space-y-4 lg:col-span-8">{children}</div>
    </section>
  );
}
