import { GameLabPlay } from "@/components/game-lab";
import { AppShell } from "@/components/learning-shell";
import { LAB_GAMES, getLabGame } from "@/lib/lab-games";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ type: string }> };

export function generateStaticParams() {
  return LAB_GAMES.map((entry) => ({ type: entry.type }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  const entry = getLabGame(type);
  if (!entry) return { title: "Practice" };
  return { title: `${entry.title} · Practice` };
}

export default async function PracticeTypePage({ params }: Props) {
  const { type } = await params;
  const entry = getLabGame(type);
  if (!entry) notFound();

  return (
    <AppShell>
      <GameLabPlay entry={entry} />
    </AppShell>
  );
}
