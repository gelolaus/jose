import { AppShell } from "@/components/learning-shell";
import { ReadingPreferencesForm } from "@/components/reading-preferences-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reading preferences",
};

export default function PreferencesPage() {
  return (
    <AppShell>
      <ReadingPreferencesForm />
    </AppShell>
  );
}
