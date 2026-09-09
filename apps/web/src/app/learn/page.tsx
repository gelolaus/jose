import { AppShell } from "@/components/learning-shell";
import { ModuleGrid } from "@/components/module-grid";
import { RecoveryState } from "@/components/recovery-state";
import { StudentClassesPanel } from "@/components/student-classes-panel";
import { TopBar } from "@/components/top-bar";
import { SignInRequired } from "@/components/sign-in-required";
import { fetchModules, fetchMyAssignments, fetchMyClasses } from "@/lib/server-api";
import type { StudentAssignment, StudentClassMembership } from "@jose/shared";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modules",
};

async function loadClasses(): Promise<{
  classes: StudentClassMembership[];
  assignments: StudentAssignment[];
  error: string | null;
}> {
  try {
    const [classes, assignments] = await Promise.all([
      fetchMyClasses(),
      fetchMyAssignments(),
    ]);
    return { classes, assignments, error: null };
  } catch (error) {
    return {
      classes: [],
      assignments: [],
      error: error instanceof Error ? error.message : "Could not load classes",
    };
  }
}

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
  const classState = await loadClasses();
  const classesPanel = (
    <StudentClassesPanel
      initialClasses={classState.classes}
      initialAssignments={classState.assignments}
      initialError={classState.error}
    />
  );

  if (data.modules.length === 0) {
    return (
      <AppShell
        topBar={
          <TopBar
            courseTitle="Jose"
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
        {classesPanel}
      </AppShell>
    );
  }

  return (
    <AppShell
      topBar={
        <TopBar
          courseTitle="Jose"
          streak={data.learner.streak}
          hearts={data.learner.hearts}
          xp={data.learner.xp}
        />
      }
    >
      <ModuleGrid
        modules={data.modules}
        continueLearning={data.continueLearning}
      />
      {classesPanel}
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
