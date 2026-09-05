import { TeachClassesClient } from "@/components/teach-classes-client";
import { DEMO_TEACHER_ID, JOSE_USER_HEADER, classSummarySchema } from "@jose/shared";

export const dynamic = "force-dynamic";

async function loadClasses() {
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";
  try {
    const res = await fetch(`${api}/teach/classes`, {
      cache: "no-store",
      headers: { [JOSE_USER_HEADER]: DEMO_TEACHER_ID },
    });
    if (!res.ok) return { classes: [], error: `API returned ${res.status}` };
    const json = await res.json();
    return { classes: classSummarySchema.array().parse(json), error: null };
  } catch (err) {
    return {
      classes: [],
      error: err instanceof Error ? err.message : "Could not load classes",
    };
  }
}

export default async function TeachClassesPage() {
  const { classes, error } = await loadClasses();
  return <TeachClassesClient initial={classes} initialError={error} />;
}
