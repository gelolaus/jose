import { UnavailableState } from "@/app/learn/page";
import { AppShell } from "@/components/learning-shell";
import { ProfileShowcase } from "@/components/profile-showcase";
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
