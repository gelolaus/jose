import { LandingPage, type LandingSignInState } from "@/components/landing-page";
import { rethrowIfNavigation } from "@/lib/navigation-error";
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
  const signedInFlag = params.signedIn === "1" || params.signedIn === "true";
  let sessionMissing = false;

  try {
    const me = await fetchAuthMe();
    if (me.authenticated) redirect("/learn");
    sessionMissing = signedInFlag;
  } catch (error) {
    // redirect() throws. Swallowing it left signed-in people on this page.
    rethrowIfNavigation(error);
  }

  let signIn: LandingSignInState = {
    reason,
    sessionMissing,
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
      sessionMissing,
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
