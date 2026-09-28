import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * School sign-in lives on the landing page. Keep this URL so Microsoft
 * denials and older links still arrive beside the login button.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const key of ["reason", "signedIn"] as const) {
    const value = params[key];
    if (typeof value === "string" && value.length > 0) next.set(key, value);
  }
  const query = next.toString();
  redirect(query ? `/?${query}` : "/");
}
