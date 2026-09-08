"use client";

import { GameSwitch } from "@/components/game-player";
import {
  GameFrame,
  StarCelebration,
  WhySheet,
} from "@/components/games/game-stage";
import type { WhyPayload } from "@/components/games/play-types";
import { hintFor, labelFor } from "@/lib/game-copy";
import { LAB_GAMES, type LabGame } from "@/lib/lab-games";
import { firstTryScore, pieceCount } from "@jose/shared";
import { ArrowLeft, Boxes, FileSearch, HelpCircle, Layers, ListOrdered, Map, PenLine, Shuffle, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

const ICONS: Record<LabGame["type"], LucideIcon> = {
  timeline: ListOrdered,
  quiz: HelpCircle,
  memory: Layers,
  sort: Boxes,
  blank: PenLine,
  "case-files": FileSearch,
  dispatches: Map,
  editorial: PenLine,
  dapitan: Wrench,
};

export function GameLabHub({ embedded = false }: { embedded?: boolean }) {
  const [filter, setFilter] = useState<"all" | "quick" | "deep">("all");
  const quickTypes: LabGame["type"][] = ["quiz", "memory", "blank", "timeline"];
  const visibleGames = LAB_GAMES.filter((entry) => filter === "all" || (filter === "quick" ? quickTypes.includes(entry.type) : !quickTypes.includes(entry.type)));

  return (
    <div
      className={
        embedded
          ? "w-full"
          : "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      }
    >
      <section className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#7c3aed_0%,#c2410c_100%)] px-5 py-6 text-white shadow-[0_16px_34px_rgba(124,58,237,0.2)] sm:px-7 sm:py-7">
        <div className="relative z-10 max-w-2xl">
          <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-white/80"><Sparkles className="size-4" aria-hidden /> Arcade corner</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Make a little history.</h1>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-white/85">Quick rounds, curious clues, and no wrong turn that doesn&apos;t teach you something.</p>
        </div>
        <div className="pointer-events-none absolute -right-7 -top-8 size-40 rounded-full border-[18px] border-white/15" />
        <Shuffle className="pointer-events-none absolute bottom-4 right-8 size-20 rotate-12 text-white/20" aria-hidden />
      </section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--jose-ink)]">Pick your kind of fun</p>
          <p className="text-sm text-[var(--jose-ink-muted)]">Everything here is optional practice.</p>
        </div>
        <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5" role="group" aria-label="Filter games">
          {(["all", "quick", "deep"] as const).map((kind) => (
            <button key={kind} type="button" onClick={() => setFilter(kind)} className={`rounded-full px-3 py-2 text-xs font-extrabold capitalize transition sm:px-4 ${filter === kind ? "bg-[var(--jose-ink)] text-white" : "text-stone-500 hover:bg-stone-100"}`}>
              {kind === "all" ? "All games" : kind === "quick" ? "Quick play" : "Take your time"}
            </button>
          ))}
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleGames.map((entry) => {
          const Icon = ICONS[entry.type];
          return (
            <li key={entry.type}>
              <Link
                href={`/practice/lab/${entry.type}`}
                className="group block overflow-hidden rounded-[1.5rem] text-white shadow-md transition hover:-translate-y-1 hover:shadow-xl active:translate-y-0.5"
              >
                <div
                  className="relative flex min-h-[12rem] flex-col justify-between overflow-hidden p-5 sm:min-h-[13rem] sm:p-6"
                  style={{ backgroundColor: entry.color }}
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/95 text-stone-800 shadow-sm transition group-hover:rotate-6 group-hover:scale-105">
                    <Icon className="size-6" strokeWidth={2.25} aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                      {entry.title}
                    </p>
                    <p className="mt-1 text-sm text-white/90 sm:text-base">
                      {entry.blurb}
                    </p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-white/70">
                      {quickTypes.includes(entry.type) ? "2–5 min · quick play" : "5–10 min · deep dive"}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GameLabPlay({ entry }: { entry: LabGame }) {
  const router = useRouter();
  const [why, setWhy] = useState<WhyPayload | null>(null);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    stars: number;
  } | null>(null);
  const [nonce, setNonce] = useState(0);

  if (result) {
    return (
      <StarCelebration
        title={entry.title}
        score={result.score}
        maxScore={result.maxScore}
        stars={result.stars}
        onRetry={() => {
          setResult(null);
          setNonce((n) => n + 1);
        }}
        onContinue={() => router.push("/practice")}
        retryLabel="Play again"
        continueLabel="All games"
      />
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6 sm:pt-4">
        <Link
          href="/practice"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--jose-surface-control)] px-4 py-2 text-sm font-extrabold text-[var(--jose-text)]"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} aria-hidden />
          All games
        </Link>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:mt-4 sm:flex-wrap sm:overflow-visible">
          {LAB_GAMES.map((item) => (
            <Link
              key={item.type}
              href={`/practice/lab/${item.type}`}
              className={`flex min-h-11 shrink-0 items-center rounded-full px-3 py-2 text-xs font-semibold ${
                item.type === entry.type
                  ? "bg-teal-800 text-white"
                  : "bg-[var(--jose-surface-elevated)] text-[var(--jose-text)] ring-1 ring-[var(--jose-rule)]"
              }`}
            >
              {item.title}
            </Link>
          ))}
        </div>
        <p className="mt-3 hidden rounded-[1.25rem] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 ring-1 ring-amber-200 sm:mt-4 sm:block">
          {entry.how} Hearts stay full here. Scores do not save to the path.
        </p>
      </div>
      <GameFrame
        title={entry.title}
        hint={hintFor(entry.type)}
        progress={labelFor(entry.type)}
        scene={entry.type}
        wide
      >
        <GameSwitch
          key={nonce}
          game={entry.game}
          disabled={Boolean(why)}
          onMiss={async (payload) => {
            if (payload) setWhy(payload);
            return "ok";
          }}
          onFinish={(_score, _max, misses) => {
            setResult(firstTryScore(pieceCount(entry.game), misses));
          }}
        />
      </GameFrame>
      {why ? <WhySheet why={why} onDismiss={() => setWhy(null)} /> : null}
    </>
  );
}
