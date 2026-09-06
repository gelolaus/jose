import { TeachLevelEditor } from "@/components/teach-level-editor";
import { isNotFoundError } from "@/lib/path-api";
import { fetchTeachLevel } from "@/lib/server-api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduleId: string; levelId: string }> };

export default async function TeachLevelPage({ params }: Props) {
  const { moduleId, levelId } = await params;
  let initial: Awaited<ReturnType<typeof fetchTeachLevel>>;
  try {
    initial = await fetchTeachLevel(levelId);
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
  return <TeachLevelEditor moduleId={moduleId} initial={initial} />;
}
