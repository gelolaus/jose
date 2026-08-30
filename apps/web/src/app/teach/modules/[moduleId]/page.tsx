import { TeachModuleEditor } from "@/components/teach-module-editor";
import { fetchTeachModule, isNotFoundError } from "@/lib/path-api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduleId: string }> };

export default async function TeachModulePage({ params }: Props) {
  const { moduleId } = await params;
  let initial: Awaited<ReturnType<typeof fetchTeachModule>>;
  try {
    initial = await fetchTeachModule(moduleId);
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
  return <TeachModuleEditor initial={initial} />;
}
