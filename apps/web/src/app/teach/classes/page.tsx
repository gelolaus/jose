import { TeachClassesClient } from "@/components/teach-classes-client";
import {
  fetchClassReport,
  fetchTeachClassAssignments,
  fetchTeachClasses,
  fetchTeachModules,
} from "@/lib/server-api";
import type { ClassReport, ClassSummary, TeachModule } from "@jose/shared";

export const dynamic = "force-dynamic";

export default async function TeachClassesPage() {
  let classes: ClassSummary[] = [];
  let modules: TeachModule[] = [];
  const reports: Record<string, ClassReport> = {};
  let error: string | null = null;
  try {
    [classes, modules] = await Promise.all([fetchTeachClasses(), fetchTeachModules()]);
    await Promise.all(
      classes.map(async (klass) => {
        const assignments = await fetchTeachClassAssignments(klass.id);
        const latest = assignments[assignments.length - 1];
        if (!latest) return;
        reports[klass.id] = await fetchClassReport(klass.id, latest.id);
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
      initialReports={reports}
      initialError={error}
    />
  );
}
