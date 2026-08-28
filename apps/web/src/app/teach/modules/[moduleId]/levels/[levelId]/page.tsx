import { TeachLevelEditor } from "@/components/teach-level-editor";
import { fetchTeachLevel } from "@/lib/path-api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduleId: string; levelId: string }> };

export default async function TeachLevelPage({ params }: Props) {
  const { moduleId, levelId } = await params;
  try {
    const initial = await fetchTeachLevel(levelId);
    return <TeachLevelEditor moduleId={moduleId} initial={initial} />;
  } catch {
    notFound();
  }
}
