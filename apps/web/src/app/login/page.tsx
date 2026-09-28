import { rethrowIfNavigation } from "@/lib/navigation-error";
import { fetchAuthMe } from "@/lib/server-api";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Older API builds finish Microsoft login here (`/login?signedIn=1`).
 * A session on this request goes to Learn. A denial still lands beside the
 * button on `/`. A signedIn flag with no cookie is reported on `/` instead of
 * pretending the landing page is a signed-in home.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const signedIn = params.signedIn === "1" || params.signedIn === "true";

  try {
    const me = await fetchAuthMe();
    if (me.authenticated) redirect("/learn");
  } catch (error) {
    rethrowIfNavigation(error);
  }

  if (signedIn) redirect("/?signedIn=1");

  const reason = typeof params.reason === "string" ? params.reason : undefined;
  redirect(reason ? `/?reason=${encodeURIComponent(reason)}` : "/");
}
