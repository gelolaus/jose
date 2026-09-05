import { UnavailableState } from "@/app/learn/page";
import { AppShell } from "@/components/learning-shell";
import { ProfileShowcase } from "@/components/profile-showcase";
import { fetchProfileStats } from "@/lib/path-api";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const result = await fetchProfileStats();

  if (!result.ok) {
    return (
      <AppShell>
        <UnavailableState
          title="Profile is temporarily unavailable"
          error={result.error}
          href="/profile"
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProfileShowcase stats={result.data} />
    </AppShell>
  );
}
