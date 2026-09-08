"use client";

import { GameSwitch } from "@/components/game-player";
import {
  GameFrame,
  StarCelebration,
  WhySheet,
} from "@/components/games/game-stage";
import type { WhyPayload } from "@/components/games/play-types";
import { hintFor } from "@/lib/game-copy";
import { LAB_GAMES, type LabGame } from "@/lib/lab-games";
import { firstTryScore, pieceCount } from "@jose/shared";
import { ArrowLeft, Boxes, FileSearch, HelpCircle, Layers, ListOrdered, Map, PenLine, Wrench } from "lucide-react";
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
  return (
    <div
      className={
        embedded
          ? "w-full"
          : "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      }
    >
      {!embedded ? <header className="mb-7"><h1 className="text-3xl font-extrabold sm:text-4xl">Pick a game. Learn something new.</h1><p className="mt-2 font-semibold text-[var(--jose-text-muted)]">Short rounds to put your Rizal knowledge to the test.</p></header> : null}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LAB_GAMES.map((entry, index) => {
          const Icon = ICONS[entry.type];
          return (
            <li key={entry.type}>
              <Link
                href={`/practice/lab/${entry.type}`}
                className="learning-card group block h-full overflow-hidden rounded-3xl border-2 text-[var(--jose-text)]"
              >
                <div
                  className="relative flex min-h-[12rem] flex-col justify-between overflow-hidden p-5 sm:min-h-[13rem] sm:p-6"
                >
                  <span className={`lesson-icon lesson-icon--${index % 4} mb-5 flex size-14 items-center justify-center rounded-2xl transition group-hover:-rotate-6`}>
                    <Icon className="size-6" strokeWidth={2.25} aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                      {entry.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--jose-text-muted)] sm:text-base">
                      {entry.blurb}
                    </p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--jose-text-muted)]">
                      {entry.type === "memory" ? "Beat the clock" : "Play a round"}
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
        timedOut={entry.type === "memory" && result.score === 0}
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

        <p className="mt-2 text-xs font-bold text-[var(--jose-text-muted)]">Free practice · No lives lost · Progress isn’t saved</p>
      </div>
      <GameFrame
        title={entry.title}
        hint={hintFor(entry.type)}
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
