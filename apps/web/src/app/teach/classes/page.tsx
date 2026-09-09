import { TeachClassesClient } from "@/components/teach-classes-client";
import {
  fetchGradebook,
  fetchTeachClasses,
  fetchTeachModules,
} from "@/lib/server-api";
import type {
  ClassSummary,
  GradebookResponse,
  TeachModule,
} from "@jose/shared";

export const dynamic = "force-dynamic";

export default async function TeachClassesPage() {
  let classes: ClassSummary[] = [];
  let modules: TeachModule[] = [];
  const gradebook: Record<string, GradebookResponse> = {};
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
        });
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
      initialError={error}
    />
  );
}
