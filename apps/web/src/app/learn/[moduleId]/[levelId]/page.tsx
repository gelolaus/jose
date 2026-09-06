import { UnavailableState } from "@/app/learn/page";
import { ChestPlayer } from "@/components/chest-player";
import { GamePlayer } from "@/components/game-player";
import { AppShell } from "@/components/learning-shell";
import { LessonPlayer } from "@/components/lesson-player";
import { SignInRequired } from "@/components/sign-in-required";
import { fetchPlayLevel } from "@/lib/server-api";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ moduleId: string; levelId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { levelId } = await params;
  const result = await fetchPlayLevel(levelId);
  if (!result.ok) return { title: "Level" };
  return { title: result.data.level.title };
}

export default async function PlayLevelPage({ params }: Props) {
  const { moduleId, levelId } = await params;
  const result = await fetchPlayLevel(levelId);

  if (!result.ok) {
    if (result.status === 401) {
      return (
        <AppShell>
          <SignInRequired />
        </AppShell>
      );
    }
    if (result.status === 403) redirect(`/learn/${moduleId}`);
    if (result.status === 404) notFound();
    return (
      <AppShell>
        <UnavailableState
          title="Can't load this level"
          error={result.error}
          href={`/learn/${moduleId}`}
        />
      </AppShell>
    );
  }

  const { data } = result;
  if (data.level.moduleId !== moduleId) {
    redirect(`/learn/${data.level.moduleId}/${levelId}`);
  }

  return (
    <AppShell
      topBar={
        <header className="border-b border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <Link
              href={data.mapHref ?? `/learn/${moduleId}`}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700"
            >
              <ArrowLeft className="size-4" strokeWidth={2.25} aria-hidden />
              Path
            </Link>
            <p className="truncate font-display text-lg font-semibold tracking-tight text-[var(--jose-ink)] md:text-xl">
              {data.level.sectionTitle}
            </p>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-800">
              Unlimited learning
            </span>
          </div>
        </header>
      }
    >
      {data.level.kind === "lesson" && data.lesson ? (
        <LessonPlayer
          levelId={levelId}
          moduleId={moduleId}
          title={data.level.title}
          lesson={data.lesson}
          nextLevelId={data.nextLevelId}
        />
      ) : null}
      {data.level.kind === "game" && data.game && data.attempt ? (
        <GamePlayer
          key={data.learner.id}
          levelId={levelId}
          moduleId={moduleId}
          title={data.level.title}
          game={data.game}
          attempt={data.attempt}
          accountId={data.learner.id}
          hearts={data.learner.hearts}
          nextLevelId={data.nextLevelId}
        />
      ) : null}
      {data.level.kind === "chest" && data.chest ? (
        <ChestPlayer
          levelId={levelId}
          moduleId={moduleId}
          title={data.level.title}
          message={data.chest.message}
          nextLevelId={data.nextLevelId}
        />
      ) : null}
    </AppShell>
  );
}
