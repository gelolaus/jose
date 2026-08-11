import { AppShell } from "@/components/learning-shell";
import { fetchDemoPath, findNode } from "@/lib/path-api";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ nodeId: string }> };

export default async function LessonPlaceholderPage({ params }: Props) {
  const { nodeId } = await params;
  const result = await fetchDemoPath();

  if (!result.ok) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Can&apos;t load lesson
          </p>
          <p className="text-lg text-slate-600">{result.error}</p>
          <Link href="/learn" className="font-extrabold text-violet-700 underline">
            Back to path
          </Link>
        </div>
      </AppShell>
    );
  }

  const found = findNode(result.data, nodeId);
  if (!found) notFound();

  if (found.node.status === "locked") {
    redirect("/learn");
  }

  return (
    <AppShell
      topBar={
        <header className="border-b border-black/5 bg-white/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700"
            >
              <ArrowLeft className="size-4" strokeWidth={2.5} aria-hidden />
              Path
            </Link>
            <p className="font-display text-lg font-semibold tracking-tight text-slate-800 md:text-xl">
              {found.section.title}
            </p>
            <span className="w-20" />
          </div>
        </header>
      }
    >
      <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center gap-5 px-6 py-12 text-center md:py-20">
        <div className="flex size-28 items-center justify-center rounded-full bg-[var(--jose-gold)] text-slate-800 node-3d md:size-32">
          <BookOpen className="size-14 md:size-16" strokeWidth={2.4} aria-hidden />
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-800 md:text-5xl">
          {found.node.title}
        </h1>
        <p className="max-w-md text-lg font-semibold text-slate-600 md:text-xl">
          Lesson coming soon! This is a placeholder so you can try the path flow
          for{" "}
          <span className="text-violet-700">Work and Life of Rizal</span>.
        </p>
        <Link
          href="/learn"
          className="mt-2 rounded-full bg-violet-600 px-7 py-3.5 text-base font-extrabold text-white shadow-md"
        >
          Back to adventure
        </Link>
      </main>
    </AppShell>
  );
}
