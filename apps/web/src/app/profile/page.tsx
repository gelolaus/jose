import { AppShell } from "@/components/learning-shell";
import { ProfileShowcase } from "@/components/profile-showcase";
import { RecoveryState } from "@/components/recovery-state";
import { SignInRequired } from "@/components/sign-in-required";
import { fetchProfileStats } from "@/lib/server-api";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const result = await fetchProfileStats();

  if (!result.ok) {
    if (result.status === 401) {
      return (
        <AppShell>
          <SignInRequired title="Sign in to see your profile" />
        </AppShell>
      );
    }
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
