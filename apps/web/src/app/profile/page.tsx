import { AppShell } from "@/components/learning-shell";
import { ProfileShowcase } from "@/components/profile-showcase";
import { fetchDemoPath } from "@/lib/path-api";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const result = await fetchDemoPath();

  if (!result.ok) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <p className="font-display text-3xl font-semibold text-slate-800 md:text-4xl">
            Profile is napping
          </p>
          <p className="text-base font-semibold text-slate-600">{result.error}</p>
          <p className="text-sm text-slate-500">
            Start the API with{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              npm run dev:api
            </code>
          </p>
          <Link
            href="/profile"
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md"
          >
            Retry
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProfileShowcase path={result.data} />
    </AppShell>
  );
}
