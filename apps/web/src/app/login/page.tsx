import type { Metadata } from "next";
import { LoginPanel } from "@/components/login-panel";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  const signedIn = params.signedIn === "1" || params.signedIn === "true";
  return <LoginPanel reason={reason} signedIn={signedIn} />;
}
