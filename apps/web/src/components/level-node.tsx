/* eslint-disable @next/next/no-img-element */
"use client";

import type { LevelNode as LevelNodeType } from "@jose/shared";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";

const GAME_NODE_SPRITES: Partial<
  Record<NonNullable<LevelNodeType["gameType"]>, string>
> = {
  timeline: "/assets/path-game-timeline-pixel.png",
  quiz: "/assets/path-game-quiz-pixel.png",
  memory: "/assets/path-game-memory-pixel.png",
  sort: "/assets/path-game-sort-pixel.png",
  blank: "/assets/path-game-blank-pixel.png",
};

function nodeSprite(node: LevelNodeType): string {
  if (node.kind === "lesson") return "/assets/path-book-pixel.png";
  if (node.kind === "chest") return "/assets/path-chest-pixel.png";
  if (node.gameType) {
    return GAME_NODE_SPRITES[node.gameType] ?? "/assets/path-game-quiz-pixel.png";
  }
  return "/assets/path-game-quiz-pixel.png";
}

/** Circle/chest sits on the path point; title hangs below without shifting alignment. */
export function LevelNode({
  node,
  moduleId,
}: {
  node: LevelNodeType;
  moduleId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [shake, setShake] = useState(false);
  const locked = node.status === "locked";
  const current = node.status === "current";

  function onActivate() {
    if (locked) {
      setShake(true);
      toast.message("Finish the previous level first!");
      window.setTimeout(() => setShake(false), 450);
      return;
    }
    router.push(`/learn/${moduleId}/${node.id}`);
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={`${node.title}${
        locked
          ? " (locked)"
          : node.status === "completed"
            ? node.kind === "lesson"
              ? " (completed, read again)"
              : " (completed, review)"
            : ""
      }`}
      className={`relative ${shake ? "node-shake" : ""} ${current && node.kind !== "chest" ? "node-pulse" : ""}`}
    >
      {node.kind === "chest" ? (
        <span
          className={`path-node-shell flex h-20 w-24 items-center justify-center rounded-[1.75rem] bg-white/90 shadow-md ring-2 md:h-24 md:w-28 md:rounded-[2rem] ${
            locked ? "path-node-shell--locked ring-white/40" : "ring-amber-200"
          } ${current ? "node-pulse" : ""}`}
        >
          <NodeGlyph node={node} />
        </span>
      ) : (
        <span
          className={`flex h-20 w-20 items-center justify-center rounded-full level-disc transition md:h-24 md:w-24 ${
            locked ? "level-disc--locked" : node.status === "completed" ? "level-disc--completed" : ""
          } ${current ? "ring-4 ring-white/80" : ""}`}
        >
          <NodeGlyph node={node} />
        </span>
      )}
      <span className="absolute left-1/2 top-[calc(100%+0.65rem)] w-max max-w-[10.5rem] -translate-x-1/2 text-center text-base font-extrabold leading-snug path-node-label md:max-w-[13rem] md:text-lg">
        {node.title}
      </span>
    </button>
  );
}

function NodeGlyph({
  node,
}: {
  node: LevelNodeType;
}) {
  return (
    <span className="path-node-icon-frame">
      <img
        src={nodeSprite(node)}
        alt=""
        aria-hidden
        className="path-node-pixel-icon"
      />
      {node.status === "completed" ? (
        <span className="path-node-complete-badge" aria-hidden>
          <Check className="size-3 md:size-3.5" strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}
