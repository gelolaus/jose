import type { ReactNode } from "react";
import { StatusHud } from "@/components/status-hud";

type TopBarProps = {
  courseTitle: string;
  streak: number;
  hearts: number;
  xp: number;
};

export function TopBar({ courseTitle, streak, hearts, xp }: TopBarProps) {
  return (
    <header className="jose-topbar">
      <div className="jose-topbar__inner">
        <span className="sr-only">{courseTitle} learner status</span>
        <StatusHud xp={xp} streak={streak} hearts={hearts} />
      </div>
    </header>
  );
}

export function IconBubble({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex size-28 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-black/5 md:size-32 ${className}`}
    >
      {children}
    </div>
  );
}
