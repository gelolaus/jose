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
    <header className="border-b border-[var(--jose-rule)] bg-[var(--jose-paper)]/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 lg:hidden">
            Jose
          </p>
          <h1 className="truncate font-display text-lg font-semibold leading-tight tracking-tight text-[var(--jose-ink)] sm:text-2xl md:text-3xl">
            {courseTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Chip tone="sky" icon={Zap} label={`${xp} XP`} />
          <Chip tone="coral" icon={Flame} label={`${streak}`} />
          <Chip
            tone="rose"
            icon={Heart}
            label={`${hearts}`}
            title="Arcade challenge lives (optional)"
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
  title,
}: {
  label: string;
  tone: "sky" | "coral" | "rose";
  icon: LucideIcon;
  title?: string;
}) {
  const tones = {
    sky: "bg-cyan-100 text-cyan-900",
    coral: "bg-orange-100 text-orange-900",
    rose: "bg-rose-100 text-rose-900",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums sm:px-3.5 sm:py-2 sm:text-base ${tones[tone]}`}
    >
      <Icon className="size-4 sm:size-5" strokeWidth={2.25} aria-hidden />
      {label}
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
      className={`flex size-28 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-black/5 md:size-32 ${className}`}
    >
      {children}
    </div>
  );
}
