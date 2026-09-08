"use client";

import type { GameContent } from "@jose/shared";
import { howToPlay } from "@/lib/game-copy";
import type { ReactNode } from "react";

export type GameScene = GameContent["type"];

export function GameBoard({
  scene,
  how,
  step,
  children,
}: {
  scene: GameScene;
  how?: string;
  step?: string;
  children: ReactNode;
}) {
  return (
    <div className={`game-board game-board--${scene}`} data-game-scene={scene}>
      <div className="game-board__paper">
        <p className="game-board__how">
          <span className="game-board__how-label">How to play</span>
          <span className="game-board__how-text">{how ?? howToPlay(scene)}</span>
        </p>
        {step ? (
          <p className="game-board__step" aria-live="polite">
            {step}
          </p>
        ) : null}
        <div className="game-board__play">{children}</div>
      </div>
    </div>
  );
}
