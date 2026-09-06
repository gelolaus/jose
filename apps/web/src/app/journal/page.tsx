import { AppShell } from "@/components/learning-shell";
import { JournalView } from "@/components/journal-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Journal",
};

export default function JournalPage() {
  return (
    <AppShell>
      <JournalView />
    </AppShell>
  );
}
