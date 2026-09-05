import { UnavailableState } from "@/app/learn/page";
import { AppShell } from "@/components/learning-shell";
import { PracticeReviewPlayer } from "@/components/practice-review-player";
import { fetchPlayLevel } from "@/lib/path-api";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ levelId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { levelId } = await params;
  const result = await fetchPlayLevel(levelId);
  if (!result.ok) return { title: "Practice review" };
  return { title: `Practice · ${result.data.level.title}` };
}

export default async function PracticeReviewPage({ params }: Props) {
  const { levelId } = await params;
  const result = await fetchPlayLevel(levelId);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <AppShell>
        <UnavailableState
          title="Can't load this review"
          error={result.error}
          href="/practice"
        />
      </AppShell>
    );
  }
  if (result.data.level.kind !== "game" || !result.data.game) {
    notFound();
  }

  return (
    <AppShell>
      <PracticeReviewPlayer
        levelId={levelId}
        title={result.data.level.title}
        game={result.data.game}
      />
    </AppShell>
  );
}
