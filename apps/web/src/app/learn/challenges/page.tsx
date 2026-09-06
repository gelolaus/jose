import { AppShell } from "@/components/learning-shell";
import { ClassChallengesClient } from "@/components/class-challenges-client";
import { SignInRequired } from "@/components/sign-in-required";
import { RecoveryState } from "@/components/recovery-state";
import { ApiError } from "@/lib/path-api";
import { fetchMyChallenges } from "@/lib/server-api";
import type { StudentChallengeListItem } from "@jose/shared";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Class challenges",
};

export default async function ClassChallengesPage() {
  let items: StudentChallengeListItem[] = [];
  let error: string | null = null;
  try {
    items = await fetchMyChallenges();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return (
        <AppShell>
          <SignInRequired title="Sign in to see class challenges" />
        </AppShell>
      );
    }
    error = err instanceof Error ? err.message : "Could not load challenges";
    if (err instanceof ApiError && err.status >= 500) {
      return (
        <AppShell>
          <RecoveryState
            title="Class challenges are temporarily unavailable"
            error={error}
            href="/learn/challenges"
            status={err.status}
          />
        </AppShell>
      );
    }
  }

  return (
    <AppShell>
      <ClassChallengesClient initial={items} initialError={error} />
    </AppShell>
  );
}
