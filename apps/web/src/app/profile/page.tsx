import { AppShell } from "@/components/learning-shell";
import { IconBubble } from "@/components/top-bar";
import { UserRound } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <IconBubble className="bg-rose-50 text-rose-600">
          <UserRound className="size-12 md:size-14" strokeWidth={2.25} aria-hidden />
        </IconBubble>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-800 md:text-5xl">
          Profile
        </h1>
        <p className="max-w-lg text-lg font-semibold text-slate-600 md:text-xl">
          Explorer mode — accounts and saved progress come later.
        </p>
        <Link
          href="/learn"
          className="rounded-full bg-rose-500 px-6 py-3 text-base font-extrabold text-white shadow-md"
        >
          Back to path
        </Link>
      </main>
    </AppShell>
  );
}
