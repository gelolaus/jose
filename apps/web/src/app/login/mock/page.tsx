import type { Metadata } from "next";
import { Suspense } from "react";
import { MockIdentityPicker } from "@/components/mock-identity-picker";

export const metadata: Metadata = {
  title: "Mock Microsoft login",
};

export default function MockLoginPage() {
  return (
    <Suspense fallback={<main className="jose-login">Loading mock identities…</main>}>
      <MockIdentityPicker />
    </Suspense>
  );
}
