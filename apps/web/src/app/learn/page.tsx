import { AppShell } from "@/components/learning-shell";
import { ModuleGrid } from "@/components/module-grid";
import { TopBar } from "@/components/top-bar";
import { SignInRequired } from "@/components/sign-in-required";
import { fetchModules } from "@/lib/server-api";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modules",
};

export default async function LearnPage() {
  const result = await fetchModules();

  if (!result.ok) {
    if (result.status === 401) {
      return (
        <AppShell>
          <SignInRequired />
        </AppShell>
      );
    }
    return (
      <AppShell>
        <NapState title="Modules are napping" error={result.error} href="/learn" />
      </AppShell>
    );
  }

  const { data } = result;

  return (
    <AppShell
      topBar={
        <TopBar
          courseTitle="Work and Life of Rizal"
          streak={data.learner.streak}
          hearts={data.learner.hearts}
          xp={data.learner.xp}
        />
      }
    >
      <ModuleGrid modules={data.modules} />
    </AppShell>
  );
}

export function NapState({
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
      <p className="font-display text-3xl font-semibold text-slate-800 md:text-4xl">
        {title}
      </p>
      <p className="text-base font-semibold text-slate-600">{error}</p>
      <p className="text-sm text-slate-500">
        Start the API with{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run dev:api</code>
      </p>
      <Link
        href={href}
        className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md"
      >
        Retry
      </Link>
    </div>
  );
}
