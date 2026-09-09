import { TeachClassesClient } from "@/components/teach-classes-client";
import {
  fetchClassRoster,
  fetchGradebook,
  fetchTeachClasses,
  fetchTeachModules,
} from "@/lib/server-api";
import type {
  ClassRosterResponse,
  ClassSummary,
  GradebookResponse,
  TeachModule,
} from "@jose/shared";

export const dynamic = "force-dynamic";

export default async function TeachClassesPage() {
  let classes: ClassSummary[] = [];
  let modules: TeachModule[] = [];
  const gradebook: Record<string, GradebookResponse> = {};
  const roster: Record<string, ClassRosterResponse> = {};
  let error: string | null = null;
  try {
    [classes, modules] = await Promise.all([
      fetchTeachClasses(),
      fetchTeachModules(),
    ]);
    await Promise.all(
      classes.map(async (klass) => {
        gradebook[klass.id] = await fetchGradebook(klass.id, {
          includeArchived: true,
          limit: 20,
        });
        try {
          roster[klass.id] = await fetchClassRoster(klass.id, { limit: 100 });
        } catch {
          // Roster stays empty; client still renders zero-assignment classes.
        }
      }),
    );
  } catch (err) {
    classes = [];
    modules = [];
    error = err instanceof Error ? err.message : "Could not load classes";
  }
  return (
    <TeachClassesClient
      initial={classes}
      modules={modules}
      initialGradebook={gradebook}
      initialRoster={roster}
      initialError={error}
    />
  );
}
