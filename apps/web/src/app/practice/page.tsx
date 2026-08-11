import { AppShell } from "@/components/learning-shell";
import { IconBubble } from "@/components/top-bar";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function PracticePage() {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <IconBubble className="bg-sky-50 text-sky-600">
          <Sparkles className="size-12 md:size-14" strokeWidth={2.25} aria-hidden />
        </IconBubble>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-800 md:text-5xl">
          Practice
        </h1>
        <p className="max-w-lg text-lg font-semibold text-slate-600 md:text-xl">
          Mini-games and drills land here next. For now, keep exploring the path!
        </p>
        <Link
          href="/learn"
          className="rounded-full bg-sky-600 px-6 py-3 text-base font-extrabold text-white shadow-md"
        >
          Go to Learn
        </Link>
      </main>
    </AppShell>
  );
}
