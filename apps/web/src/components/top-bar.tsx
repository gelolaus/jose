import { Flame, Heart, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type TopBarProps = {
  courseTitle: string;
  streak: number;
  hearts: number;
  xp: number;
};

export function TopBar({ courseTitle, streak, hearts, xp }: TopBarProps) {
  return (
    <header className="border-b border-black/5 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-500 lg:hidden">
            Jose
          </p>
          <h1 className="truncate font-display text-lg font-semibold leading-tight tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
            {courseTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Chip tone="sky" icon={Zap} label={`${xp} XP`} accessibleName={`${xp} experience points`} />
          <Chip
            tone="coral"
            icon={Flame}
            label={`${streak}`}
            accessibleName={`${streak} day streak`}
          />
          <Chip
            tone="rose"
            icon={Heart}
            label={`${hearts}`}
            accessibleName={`${hearts} hearts remaining`}
          />
        </div>
      </div>
    </header>
  );
}

function Chip({
  label,
  tone,
  icon: Icon,
  accessibleName,
}: {
  label: string;
  tone: "sky" | "coral" | "rose";
  icon: LucideIcon;
  accessibleName: string;
}) {
  const tones = {
    sky: "bg-sky-100 text-sky-700",
    coral: "bg-orange-100 text-orange-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <span
      role="status"
      aria-label={accessibleName}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold tabular-nums sm:px-3.5 sm:py-2 sm:text-base ${tones[tone]}`}
    >
      <Icon className="size-4 sm:size-5" strokeWidth={2.5} aria-hidden />
      <span aria-hidden>{label}</span>
    </span>
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
      className={`flex size-28 items-center justify-center rounded-[2rem] bg-white shadow-md ring-1 ring-black/5 md:size-32 ${className}`}
    >
      {children}
    </div>
  );
}
