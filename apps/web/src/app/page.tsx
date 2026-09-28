import { LandingPage, type LandingSignInState } from "@/components/landing-page";
import { fetchAuthMe, fetchAuthStatus } from "@/lib/server-api";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jose",
  description:
    "Short lessons and games for APC’s Work and Life of Rizal course. Sign in with your school Microsoft account.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : undefined;

  try {
    const me = await fetchAuthMe();
    if (me.authenticated) redirect("/learn");
  } catch {
    // API down: still show the landing page instead of dumping the visitor into Learn.
  }

  let signIn: LandingSignInState = {
    reason,
    mode: "unknown",
    mockEnabled: false,
    demoMode: false,
    signInReady: false,
    statusMessage: "Could not reach the Jose API auth status endpoint.",
  };

  try {
    const status = await fetchAuthStatus();
    const ready = status.mode === "microsoft" || status.mode === "mock";
    signIn = {
      reason,
      mode: status.mode,
      mockEnabled: status.mockEnabled,
      demoMode: status.demoMode,
      signInReady: ready,
      statusMessage: ready
        ? null
        : status.configError ||
          "Microsoft login is not configured yet. See docs/auth/microsoft-entra-setup.md.",
    };
  } catch {
    // Keep the unreachable-API message.
  }

  return <LandingPage signIn={signIn} />;
}
