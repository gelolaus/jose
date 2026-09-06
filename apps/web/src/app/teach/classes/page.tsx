import { TeachClassesClient } from "@/components/teach-classes-client";
import { fetchTeachClasses } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function TeachClassesPage() {
  let classes;
  let error: string | null = null;
  try {
    classes = await fetchTeachClasses();
  } catch (err) {
    classes = [];
    error = err instanceof Error ? err.message : "Could not load classes";
  }
  return <TeachClassesClient initial={classes} initialError={error} />;
}
