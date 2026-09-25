import Link from "next/link";

/** Shown when a learner has no Lives left for a module game. */
export function OutOfLives({ moduleId }: { moduleId: string }) {
  return (
    <section
      role="alert"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-[var(--jose-rule)] bg-[var(--jose-paper)] px-6 py-10 text-center"
    >
      <p className="font-display text-2xl font-semibold text-[var(--jose-ink)]">
        You&apos;re out of Lives
      </p>
      <p className="text-sm text-stone-600">
        Read a lesson again to earn a Life back, then return to this game.
      </p>
      <Link
        href={`/learn/${moduleId}`}
        className="inline-flex min-h-11 items-center rounded-xl bg-[#12122e] px-5 py-2 text-sm font-semibold text-white"
      >
        Back to path
      </Link>
    </section>
  );
}
