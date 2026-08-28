"use client";

import type { LevelNode as LevelNodeType, PathResponse, Section } from "@jose/shared";
import { Check, Compass, Lock, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LevelNode } from "./level-node";

/** Shared lane % — SVG spine and nodes use the exact same X values. */
export const PATH_LANE_X: Record<LevelNodeType["position"], number> = {
  left: 28,
  center: 50,
  right: 72,
};

const ROW_PX = 176;

export function PathView({ path }: { path: PathResponse }) {
  const [activeSectionId, setActiveSectionId] = useState(path.sections[0]?.id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const section of path.sections) {
      const el = sectionRefs.current[section.id];
      if (!el) continue;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveSectionId(section.id);
            }
          }
        },
        { root: null, rootMargin: "-30% 0px -45% 0px", threshold: 0.01 },
      );
      observer.observe(el);
      observers.push(observer);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [path.sections]);

  const active =
    path.sections.find((s) => s.id === activeSectionId) ?? path.sections[0];

  return (
    <div className="relative xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="min-w-0">
        <div
          className="sticky top-0 z-20 px-4 py-3.5 sm:px-6 lg:px-8 xl:hidden"
          style={{ backgroundColor: active?.themeColor }}
        >
          <SectionBannerCard section={active} elevated={false} />
        </div>

        <div className="flex w-full flex-col">
          {path.sections.map((section, sectionIndex) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              ref={(el) => {
                sectionRefs.current[section.id] = el;
              }}
              data-section={section.id}
              className={`relative w-full scroll-mt-4 px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8 ${
                sectionIndex === 0 ? "pt-5 sm:pt-7" : "pt-10 sm:pt-12"
              }`}
              style={{ backgroundColor: section.themeColor }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 20%, white 0 2px, transparent 3px), radial-gradient(circle at 80% 40%, white 0 1.5px, transparent 2.5px)",
                  backgroundSize: "42px 42px, 28px 28px",
                }}
              />
              <div className="relative mx-auto mb-8 max-w-3xl text-center md:mb-10">
                <p className="font-display text-3xl font-semibold tracking-tight text-white drop-shadow sm:text-4xl md:text-5xl">
                  {section.title}
                </p>
                <p className="mt-1 text-base font-bold text-white/90 sm:text-lg md:text-xl">
                  {section.subtitle}
                </p>
              </div>
              <PathTrack nodes={section.nodes} moduleId={path.module.id} />
              <MascotAccent sectionId={section.id} />
            </section>
          ))}
        </div>
      </div>

      <aside className="sticky top-4 hidden self-start px-4 py-6 xl:block">
        <PathAside path={path} active={active} />
      </aside>
    </div>
  );
}

function PathTrack({
  nodes,
  moduleId,
}: {
  nodes: LevelNodeType[];
  moduleId: string;
}) {
  const n = nodes.length;
  if (n === 0) return null;

  const points = nodes.map((node, i) => ({
    x: PATH_LANE_X[node.position],
    y: ((i + 0.5) / n) * 100,
  }));

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }

  return (
    <div
      className="relative mx-auto w-full max-w-lg sm:max-w-xl md:max-w-2xl"
      style={{ height: `${n * ROW_PX}px` }}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {nodes.map((node, i) => (
        <div
          key={node.id}
          className="absolute z-10"
          style={{
            left: `${PATH_LANE_X[node.position]}%`,
            top: `${((i + 0.5) / n) * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <LevelNode node={node} moduleId={moduleId} />
        </div>
      ))}
    </div>
  );
}

function PathAside({
  path,
  active,
}: {
  path: PathResponse;
  active?: Section;
}) {
  return (
    <div className="space-y-5">
      <SectionBannerCard section={active} elevated />
      <div className="rounded-[1.75rem] border border-black/8 bg-white/90 p-5 shadow-sm">
        <p className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
          <Compass className="size-4" strokeWidth={2.5} aria-hidden />
          Journey map
        </p>
        <ul className="space-y-2.5">
          {path.sections.map((section) => {
            const done = section.nodes.every((n) => n.status === "completed");
            const current = section.nodes.some((n) => n.status === "current");
            const isActive = active?.id === section.id;
            return (
              <li key={section.id}>
                <a
                  href={`#section-${section.id}`}
                  className={`flex items-center gap-3 rounded-3xl px-3 py-2.5 transition hover:bg-slate-50 ${
                    isActive ? "bg-slate-50 ring-1 ring-black/5" : ""
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: section.themeColor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-extrabold text-slate-800">
                      {section.title}
                    </span>
                    <span className="block truncate text-sm font-semibold text-slate-500">
                      {section.subtitle}
                    </span>
                  </span>
                  <StatusBadge done={done} current={current} />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ done, current }: { done: boolean; current: boolean }) {
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-extrabold text-emerald-600">
        <Check className="size-4" strokeWidth={2.75} aria-hidden />
        Done
      </span>
    );
  }
  if (current) {
    return (
      <span className="text-sm font-extrabold text-violet-600">Now</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-extrabold text-slate-400">
      <Lock className="size-3.5" strokeWidth={2.5} aria-hidden />
      Soon
    </span>
  );
}

function SectionBannerCard({
  section,
  elevated = true,
}: {
  section?: Section;
  elevated?: boolean;
}) {
  if (!section) return null;
  return (
    <div
      className={`rounded-[1.75rem] px-5 py-4 text-white sm:rounded-[2rem] sm:px-6 sm:py-5 ${
        elevated ? "shadow-lg ring-2 ring-white/40" : "ring-1 ring-white/30"
      }`}
      style={{ backgroundColor: elevated ? section.themeColor : "transparent" }}
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/80">
        Now exploring
      </p>
      <p className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {section.title}
      </p>
      <p className="mt-0.5 text-base font-semibold text-white/90 sm:text-lg">
        {section.subtitle}
      </p>
    </div>
  );
}

function MascotAccent({ sectionId }: { sectionId: string }) {
  const side =
    sectionId.length % 2 === 0 ? "left-4 sm:left-8" : "right-4 sm:right-8";
  return (
    <div
      className={`float-soft pointer-events-none absolute bottom-8 ${side} flex size-16 items-center justify-center rounded-full bg-white/90 text-violet-600 shadow-md md:size-20`}
      aria-hidden
    >
      <Smile className="size-8 md:size-10" strokeWidth={2.25} />
    </div>
  );
}
