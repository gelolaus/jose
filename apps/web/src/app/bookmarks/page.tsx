import { AppShell } from "@/components/learning-shell";
import { BookmarksView } from "@/components/bookmarks-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bookmarks",
};

export default function BookmarksPage() {
  return (
    <AppShell>
      <BookmarksView />
    </AppShell>
  );
}
