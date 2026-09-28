import { AppShell } from "@/components/learning-shell";
import { ProfileShowcase } from "@/components/profile-showcase";
import { RecoveryState } from "@/components/recovery-state";
import { redirectToLanding } from "@/lib/landing-gate";
import { fetchProfileStats } from "@/lib/server-api";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const result = await fetchProfileStats();

  if (!result.ok) {
    if (result.status === 401) redirectToLanding();
    return (
      <AppShell>
        <RecoveryState
          title="Profile unavailable"
          error={result.error}
          href="/profile"
          status={result.status}
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
