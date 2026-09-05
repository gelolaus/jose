import { AppShell } from "@/components/learning-shell";
import { ProfileShowcase } from "@/components/profile-showcase";
import { RecoveryState } from "@/components/recovery-state";
import { fetchDemoPath } from "@/lib/path-api";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const result = await fetchDemoPath();

  if (!result.ok) {
    return (
      <AppShell>
        <RecoveryState
          title="Profile unavailable"
          error={result.error}
          href="/profile"
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProfileShowcase path={result.data} />
    </AppShell>
  );
}
