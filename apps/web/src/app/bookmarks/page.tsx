import { AppShell } from "@/components/learning-shell";
import { BookmarksView } from "@/components/bookmarks-view";
import { fetchAuthMe } from "@/lib/server-api";
import { redirectToLanding } from "@/lib/landing-gate";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookmarks",
};

export default async function BookmarksPage() {
  try {
    const me = await fetchAuthMe();
    if (!me.authenticated && !me.demoMode) redirectToLanding();
  } catch {
    redirectToLanding();
  }

  return (
    <AppShell>
      <BookmarksView />
    </AppShell>
  );
}
