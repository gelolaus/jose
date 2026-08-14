"use client";

import type { LevelNode as LevelNodeType } from "@jose/shared";
import { BookOpen, Check, Gift, Puzzle, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";

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
      aria-label={`${node.title}${locked ? " (locked)" : ""}`}
      className={`relative ${shake ? "node-shake" : ""} ${current && node.kind !== "chest" ? "node-pulse" : ""}`}
    >
      {node.kind === "chest" ? (
        <span
          className={`flex h-20 w-24 items-center justify-center rounded-[1.75rem] bg-white/90 shadow-md ring-2 md:h-24 md:w-28 md:rounded-[2rem] ${
            locked ? "opacity-45 grayscale ring-white/40" : "ring-amber-200"
          } ${current ? "node-pulse" : ""}`}
        >
          <Gift
            className="size-10 text-amber-600 md:size-12"
            strokeWidth={2.25}
            aria-hidden
          />
        </span>
      ) : (
        <span
          className={`flex h-20 w-20 items-center justify-center rounded-full bg-[var(--jose-gold)] text-slate-800 node-3d transition md:h-24 md:w-24 ${
            locked ? "opacity-45 grayscale" : ""
          } ${current ? "ring-4 ring-white/80" : ""}`}
        >
          <NodeGlyph icon={node.icon} status={node.status} />
        </span>
      )}
      <span className="absolute left-1/2 top-[calc(100%+0.65rem)] w-max max-w-[10.5rem] -translate-x-1/2 text-center text-base font-extrabold leading-snug text-white drop-shadow md:max-w-[13rem] md:text-lg">
        {node.title}
      </span>
    </button>
  );
}

function NodeGlyph({
  icon,
  status,
}: {
  icon: LevelNodeType["icon"];
  status: LevelNodeType["status"];
}) {
  const className = "size-9 md:size-11";
  const stroke = 2.6;

  if (status === "completed" || icon === "check") {
    return <Check className={className} strokeWidth={stroke} aria-hidden />;
  }
  if (icon === "star") {
    return <Star className={className} strokeWidth={stroke} aria-hidden />;
  }
  if (icon === "chest") {
    return <Gift className={className} strokeWidth={stroke} aria-hidden />;
  }
  if (icon === "game") {
    return <Puzzle className={className} strokeWidth={stroke} aria-hidden />;
  }
  return <BookOpen className={className} strokeWidth={stroke} aria-hidden />;
}
