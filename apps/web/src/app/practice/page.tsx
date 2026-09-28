import { UnavailableState } from "@/app/learn/page";
import { AppShell } from "@/components/learning-shell";
import { PracticeHub } from "@/components/practice-hub";
import { redirectToLanding } from "@/lib/landing-gate";
import { fetchPracticeReview } from "@/lib/server-api";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Practice",
};

export default async function PracticePage() {
  const result = await fetchPracticeReview();
  if (!result.ok) {
    if (result.status === 401) redirectToLanding();
    return (
      <AppShell>
        <UnavailableState
          title="Practice is temporarily unavailable"
          error={result.error}
          href="/practice"
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PracticeHub review={result.data} />
    </AppShell>
  );
}
