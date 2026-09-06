import { TeachModuleWorkspace } from "@/components/teach-module-workspace";
import { isNotFoundError } from "@/lib/path-api";
import { fetchTeachModule } from "@/lib/server-api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ level?: string }>;
};

export default async function TeachModulePage({ params, searchParams }: Props) {
  const { moduleId } = await params;
  const { level } = await searchParams;
  let initial: Awaited<ReturnType<typeof fetchTeachModule>>;
  try {
    initial = await fetchTeachModule(moduleId);
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
  return <TeachModuleWorkspace initial={initial} initialLevelId={level} />;
}
