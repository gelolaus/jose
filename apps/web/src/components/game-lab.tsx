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
import { ArrowLeft, Boxes, HelpCircle, Layers, ListOrdered, PenLine } from "lucide-react";
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
};

export function GameLabHub() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-500">
          Game lab
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          Try every board
        </h1>
        <p className="mt-2 text-base font-semibold text-slate-500">
          Sample games, no hearts, nothing saved. Drag timeline events and sort chips
          onto their spots — or tap, then tap, on a phone.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LAB_GAMES.map((entry) => {
          const Icon = ICONS[entry.type];
          return (
            <li key={entry.type}>
              <Link
                href={`/practice/${entry.type}`}
                className="block overflow-hidden rounded-[2rem] text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0.5"
              >
                <div
                  className="flex min-h-[11.5rem] flex-col justify-between p-5 sm:min-h-[13rem] sm:p-6"
                  style={{ backgroundColor: entry.color }}
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/95 text-slate-800 shadow-sm">
                    <Icon className="size-6" strokeWidth={2.4} aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                      {entry.title}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white/90 sm:text-base">
                      {entry.blurb}
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
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} aria-hidden />
          All games
        </Link>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:mt-4 sm:flex-wrap sm:overflow-visible">
          {LAB_GAMES.map((item) => (
            <Link
              key={item.type}
              href={`/practice/${item.type}`}
              className={`flex min-h-11 shrink-0 items-center rounded-full px-3 py-2 text-xs font-extrabold ${
                item.type === entry.type
                  ? "bg-violet-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-black/10"
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
