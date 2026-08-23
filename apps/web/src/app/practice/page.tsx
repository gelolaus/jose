import { GameLabHub } from "@/components/game-lab";
import { AppShell } from "@/components/learning-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice",
};

export default function PracticePage() {
  return (
    <AppShell>
      <GameLabHub />
    </AppShell>
  );
}
