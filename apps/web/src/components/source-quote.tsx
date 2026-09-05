/** Source quotations vs explanation — keep original wording visually distinct. */

export function SourceQuote({
  children,
  citation,
}: {
  children: React.ReactNode;
  citation?: string;
}) {
  return (
    <figure className="my-4 border-l-4 border-amber-600 bg-amber-50/80 px-4 py-3">
      <blockquote
        className="font-serif text-base font-normal leading-relaxed text-slate-900"
        data-source-quote="true"
      >
        {children}
      </blockquote>
      {citation ? (
        <figcaption className="mt-2 text-xs font-bold uppercase tracking-wide text-amber-800">
          Source · {citation}
        </figcaption>
      ) : (
        <figcaption className="mt-2 text-xs font-bold uppercase tracking-wide text-amber-800">
          Historical source wording
        </figcaption>
      )}
    </figure>
  );
}

export function ExplanationNote({ children }: { children: React.ReactNode }) {
  return (
    <aside
      className="my-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
      data-explanation="true"
    >
      <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-400">
        Explanation
      </p>
      {children}
    </aside>
  );
}
