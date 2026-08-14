import { TeachModuleEditor } from "@/components/teach-module-editor";
import { fetchTeachModule } from "@/lib/path-api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduleId: string }> };

export default async function TeachModulePage({ params }: Props) {
  const { moduleId } = await params;
  try {
    const initial = await fetchTeachModule(moduleId);
    return <TeachModuleEditor initial={initial} />;
  } catch {
    notFound();
  }
}
