import { AppShell } from "@/components/learning-shell";
import { ModuleGrid } from "@/components/module-grid";
import { PresentationToggle } from "@/components/presentation-toggle";
import { TopBar } from "@/components/top-bar";
import { fetchModules } from "@/lib/path-api";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modules",
};

export default async function LearnPage() {
  const result = await fetchModules();

  if (!result.ok) {
    return (
      <AppShell>
        <UnavailableState
          title="Modules are temporarily unavailable"
          error={result.error}
          href="/learn"
        />
      </AppShell>
    );
  }

  const { data } = result;

  return (
    <AppShell
      topBar={
        <div>
          <TopBar
            courseTitle="Work and Life of Rizal"
            streak={data.learner.streak}
            hearts={data.learner.hearts}
            xp={data.learner.xp}
          />
          <div className="flex justify-end border-b border-[var(--jose-rule)] bg-[var(--jose-paper)]/80 px-4 py-2 lg:hidden">
            <PresentationToggle compact />
          </div>
        </div>
      }
    >
      <ModuleGrid
        modules={data.modules}
        continueLearning={data.continueLearning}
      />
    </AppShell>
  );
}

export function UnavailableState({
  title,
  error,
  href,
}: {
  title: string;
  error: string;
  href: string;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="font-display text-3xl font-semibold text-[var(--jose-ink)] md:text-4xl">
        {title}
      </p>
      <p className="text-base text-[var(--jose-ink-muted)]">{error}</p>
      <p className="text-sm text-stone-500">
        Please try again in a moment. If this keeps happening, contact your teacher
        or support with the time of the error.
      </p>
      <Link
        href={href}
        className="rounded-xl bg-[var(--jose-ink)] px-5 py-2.5 text-sm font-semibold text-[var(--jose-paper)] shadow-md"
      >
        Retry
      </Link>
    </div>
  );
}

/** @deprecated Use UnavailableState — kept for existing imports during transition. */
export function NapState(props: {
  title: string;
  error: string;
  href: string;
}) {
  return <UnavailableState {...props} />;
}
