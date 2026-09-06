import { isNotFoundError } from "@/lib/path-api";
import { fetchTeachModule } from "@/lib/server-api";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduleId: string; levelId: string }> };

export default async function TeachLevelPage({ params }: Props) {
  const { moduleId, levelId } = await params;
  try {
    await fetchTeachModule(moduleId);
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
  redirect(`/teach/modules/${moduleId}?level=${encodeURIComponent(levelId)}`);
}
