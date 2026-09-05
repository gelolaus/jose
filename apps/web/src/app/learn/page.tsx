import { AppShell } from "@/components/learning-shell";
import { ModuleGrid } from "@/components/module-grid";
import { RecoveryState } from "@/components/recovery-state";
import { TopBar } from "@/components/top-bar";
import { fetchModules } from "@/lib/path-api";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modules",
};

export default async function LearnPage() {
  const result = await fetchModules();

  if (!result.ok) {
    return (
      <AppShell>
        <RecoveryState
          title="Modules are unavailable"
          error={result.error}
          href="/learn"
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

/** @deprecated Prefer RecoveryState — kept for any remaining imports during transition. */
export { RecoveryState as NapState } from "@/components/recovery-state";
