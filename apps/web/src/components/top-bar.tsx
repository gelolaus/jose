/* eslint-disable @next/next/no-img-element */
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
    <header className="border-b border-[var(--jose-rule)] bg-[var(--jose-paper)]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <img
            src="/assets/jose-title.png"
            alt="Jose"
            className="jose-title-img jose-title-img--topbar"
          />
          <p className="truncate text-sm font-extrabold text-[var(--jose-ink)] sm:text-base">
            {courseTitle}
          </p>
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
            accessibleName={`${hearts} lives`}
            title="Lives"
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
  title,
}: {
  label: string;
  tone: "sky" | "coral" | "rose";
  icon: LucideIcon;
  accessibleName: string;
  title?: string;
}) {
  const tones = {
    sky: "bg-[#e8dcc0] text-[#c9a84c]",
    coral: "bg-[#f0d4c4] text-[#a0522d]",
    rose: "bg-[#f0d8de] text-[#7a1a2e]",
  };
  return (
    <span
      role="status"
      title={title}
      aria-label={accessibleName}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-extrabold tabular-nums sm:px-3.5 sm:py-2 sm:text-base ${tones[tone]}`}
    >
      <Icon className="size-4 sm:size-5" strokeWidth={2.25} aria-hidden />
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
      className={`flex size-28 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-black/5 md:size-32 ${className}`}
    >
      {children}
    </div>
  );
}
