import { AppShell } from "@/components/learning-shell";
import { ModuleGrid } from "@/components/module-grid";
import { PresentationToggle } from "@/components/presentation-toggle";
import { RecoveryState } from "@/components/recovery-state";
import { TopBar } from "@/components/top-bar";
import { SignInRequired } from "@/components/sign-in-required";
import { fetchModules } from "@/lib/server-api";
import type { Metadata } from "next";

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
        <RecoveryState
          title="Modules are temporarily unavailable"
          error={result.error}
          href="/learn"
          status={result.status}
        />
      </AppShell>
    );
  }

  const { data } = result;

  if (data.modules.length === 0) {
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
        <RecoveryState
          title="No modules yet"
          error="Published modules will appear here when ready."
          href="/learn"
          emptyAction={{ href: "/practice", label: "Try Practice" }}
        />
      </AppShell>
    );
  }

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
  status,
}: {
  title: string;
  error: string;
  href: string;
  status?: number;
}) {
  return <RecoveryState title={title} error={error} href={href} status={status} />;
}

/** @deprecated Use UnavailableState / RecoveryState. */
export function NapState(props: {
  title: string;
  error: string;
  href: string;
  status?: number;
}) {
  return <UnavailableState {...props} />;
}
