import { AppShell } from "@/components/learning-shell";
import { PathView } from "@/components/path-view";
import { TopBar } from "@/components/top-bar";
import { fetchDemoPath } from "@/lib/path-api";
import Link from "next/link";

export default async function LearnPage() {
  const result = await fetchDemoPath();

  if (!result.ok) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <p className="font-display text-3xl font-semibold text-slate-800 md:text-4xl">
            Path is napping
          </p>
          <p className="text-base font-semibold text-slate-600">{result.error}</p>
          <p className="text-sm text-slate-500">
            Start the API with{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              npm run dev:api
            </code>
          </p>
          <Link
            href="/learn"
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md"
          >
            Retry
          </Link>
        </div>
      </AppShell>
    );
  }

  const { data } = result;

  return (
    <AppShell
      topBar={
        <TopBar
          courseTitle={data.course.title}
          streak={data.learner.streak}
          hearts={data.learner.hearts}
          xp={data.learner.xp}
        />
      }
    >
      <PathView path={data} />
    </AppShell>
  );
}
