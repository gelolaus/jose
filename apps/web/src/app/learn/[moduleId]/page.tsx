import { AppShell } from "@/components/learning-shell";
import { PathView } from "@/components/path-view";
import { RecoveryState } from "@/components/recovery-state";
import { TopBar } from "@/components/top-bar";
import { fetchModulePath } from "@/lib/path-api";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduleId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { moduleId } = await params;
  const result = await fetchModulePath(moduleId);
  if (!result.ok) return { title: "Module" };
  return { title: result.data.module.title };
}

export default async function ModulePathPage({ params }: Props) {
  const { moduleId } = await params;
  const result = await fetchModulePath(moduleId);

  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <AppShell>
        <RecoveryState
          title="This path is unavailable"
          error={result.error}
          href={`/learn/${moduleId}`}
          status={result.status}
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
            courseTitle={data.module.title}
            streak={data.learner.streak}
            hearts={data.learner.hearts}
            xp={data.learner.xp}
          />
          <div className="border-b border-black/5 bg-white/90 px-4 py-2 sm:px-6 lg:px-8">
            <Link
              href="/learn"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-extrabold text-violet-700"
            >
              <ArrowLeft className="size-4" strokeWidth={2.5} aria-hidden />
              All modules
            </Link>
          </div>
        </div>
      }
    >
      <PathView path={data} />
    </AppShell>
  );
}
