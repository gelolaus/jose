"use client";

import type { LevelNode as LevelNodeType, PathResponse, Section } from "@jose/shared";
import {
  Check,
  ChevronDown,
  Compass,
  List,
  Lock,
  Map as MapIcon,
  Navigation,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LevelNode } from "./level-node";

/** Shared lane % — SVG spine and nodes use the exact same X values. */
export const PATH_LANE_X: Record<LevelNodeType["position"], number> = {
  left: 28,
  center: 50,
  right: 72,
};

const ROW_PX = 176;
const VIEW_KEY = "jose.pathView";
const VIEW_CHANGE = "jose:path-view-change";
const SCROLL_KEY_PREFIX = "jose.pathScroll.";

type PathViewMode = "map" | "list";

function subscribeView(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(VIEW_CHANGE, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(VIEW_CHANGE, onStoreChange);
  };
}

function getViewSnapshot(): PathViewMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "map";
  } catch {
    return "map";
  }
}

function getViewServerSnapshot(): PathViewMode {
  return "map";
}

function writeViewMode(mode: PathViewMode) {
  try {
    window.localStorage.setItem(VIEW_KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(VIEW_CHANGE));
}

function findCurrentNode(path: PathResponse) {
  for (const section of path.sections) {
    const node = section.nodes.find((n) => n.status === "current");
    if (node) return { section, node };
  }
  return null;
}

function initialCollapsed(path: PathResponse): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const section of path.sections) {
    next[section.id] = false;
  }
  return next;
}

export function PathView({ path }: { path: PathResponse }) {
  const [activeSectionId, setActiveSectionId] = useState(path.sections[0]?.id);
  const viewMode = useSyncExternalStore(
    subscribeView,
    getViewSnapshot,
    getViewServerSnapshot,
  );
  const [collapsed, setCollapsed] = useState(() => initialCollapsed(path));
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRestored = useRef(false);
  const currentNode = findCurrentNode(path);

  useEffect(() => {
    if (scrollRestored.current) return;
    try {
      const raw = sessionStorage.getItem(`${SCROLL_KEY_PREFIX}${path.module.id}`);
      if (raw) {
        const y = Number(raw);
        if (Number.isFinite(y)) {
          window.requestAnimationFrame(() => window.scrollTo(0, y));
        }
      }
    } catch {
      // ignore
    }
    scrollRestored.current = true;
  }, [path.module.id]);

  useEffect(() => {
    const onScroll = () => {
      try {
        sessionStorage.setItem(
          `${SCROLL_KEY_PREFIX}${path.module.id}`,
          String(window.scrollY),
        );
      } catch {
        // ignore
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [path.module.id]);

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
  }, [path.sections, viewMode]);

  const active =
    path.sections.find((s) => s.id === activeSectionId) ?? path.sections[0];

  function setMode(mode: PathViewMode) {
    writeViewMode(mode);
  }

  function jumpToCurrent() {
    if (!currentNode) {
      const last = path.sections[path.sections.length - 1];
      if (last) {
        document
          .getElementById(`section-${last.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    setCollapsed((prev) => ({
      ...prev,
      [currentNode.section.id]: false,
    }));
    const target =
      document.getElementById(`node-${currentNode.node.id}`) ??
      document.getElementById(`section-${currentNode.section.id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="relative xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="min-w-0">
        <div className="sticky top-0 z-30 border-b border-black/10 bg-[var(--jose-paper)]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8 xl:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="chapter-picker">
              Chapter
            </label>
            <select
              id="chapter-picker"
              className="min-w-0 flex-1 rounded-xl border border-[var(--jose-rule)] bg-white px-3 py-2 text-sm font-semibold text-[var(--jose-ink)]"
              value={active?.id}
              onChange={(event) => {
                const id = event.target.value;
                setActiveSectionId(id);
                setCollapsed((prev) => ({ ...prev, [id]: false }));
                document
                  .getElementById(`section-${id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {path.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={jumpToCurrent}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--jose-rule)] bg-white px-3 py-2 text-sm font-semibold text-[var(--jose-ink)]"
            >
              <Navigation className="size-4" strokeWidth={2.25} aria-hidden />
              Current
            </button>
            <div
              role="group"
              aria-label="Path layout"
              className="inline-flex rounded-xl border border-[var(--jose-rule)] bg-white p-1"
            >
              <button
                type="button"
                aria-pressed={viewMode === "map"}
                onClick={() => setMode("map")}
                className={`rounded-lg p-2 ${
                  viewMode === "map"
                    ? "bg-[var(--jose-ink)] text-white"
                    : "text-[var(--jose-ink-muted)]"
                }`}
              >
                <MapIcon className="size-4" aria-hidden />
                <span className="sr-only">Adventure map</span>
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setMode("list")}
                className={`rounded-lg p-2 ${
                  viewMode === "list"
                    ? "bg-[var(--jose-ink)] text-white"
                    : "text-[var(--jose-ink-muted)]"
                }`}
              >
                <List className="size-4" aria-hidden />
                <span className="sr-only">List view</span>
              </button>
            </div>
          </div>
          {active ? (
            <p className="mt-2 truncate text-sm font-semibold text-[var(--jose-ink-muted)]">
              Current · {active.title}
            </p>
          ) : null}
        </div>

        <div className="flex w-full flex-col">
          {path.sections.map((section, sectionIndex) => {
            const isCollapsed = Boolean(collapsed[section.id]);
            return (
              <section
                key={section.id}
                id={`section-${section.id}`}
                ref={(el) => {
                  sectionRefs.current[section.id] = el;
                }}
                data-section={section.id}
                className={`path-section relative w-full scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 ${
                  sectionIndex === 0 ? "pt-5 sm:pt-7" : "pt-10 sm:pt-12"
                }`}
              >
                <div className="path-heading relative mx-auto mb-6 max-w-3xl text-left md:mb-8">
                  <div className="flex items-start justify-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="path-title text-2xl font-extrabold tracking-tight sm:text-3xl">
                        {section.title}
                      </p>
                      <p className="path-subtitle mt-1 text-base font-semibold">
                        {section.subtitle}
                      </p>
                      {section.objectives.length > 0 ? (
                        <details className="path-subtitle mt-3 text-sm"><summary className="cursor-pointer font-bold">What you’ll learn</summary><ul className="mt-2 space-y-1">
                          {section.objectives.map((objective) => (
                            <li key={objective}>· {objective}</li>
                          ))}
                        </ul></details>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="mt-1 rounded-xl bg-[var(--jose-surface)] p-2 text-[var(--jose-text)] xl:hidden"
                      aria-expanded={!isCollapsed}
                      aria-controls={`section-body-${section.id}`}
                      onClick={() =>
                        setCollapsed((prev) => ({
                          ...prev,
                          [section.id]: !prev[section.id],
                        }))
                      }
                    >
                      <ChevronDown
                        className={`size-5 transition ${isCollapsed ? "-rotate-90" : ""}`}
                        aria-hidden
                      />
                      <span className="sr-only">
                        {isCollapsed ? "Expand" : "Collapse"} {section.title}
                      </span>
                    </button>
                  </div>
                </div>
                <div
                  id={`section-body-${section.id}`}
                  hidden={isCollapsed}
                  className="relative"
                >
                  {viewMode === "list" ? (
                    <PathList
                      nodes={section.nodes}
                      moduleId={path.module.id}
                    />
                  ) : (
                    <PathTrack
                      nodes={section.nodes}
                      moduleId={path.module.id}
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <aside className="sticky top-4 hidden self-start px-4 py-6 xl:block">
        <PathAside
          path={path}
          active={active}
          viewMode={viewMode}
          onViewMode={setMode}
          onJumpCurrent={jumpToCurrent}
        />
      </aside>
    </div>
  );
}

function PathList({
  nodes,
  moduleId,
}: {
  nodes: LevelNodeType[];
  moduleId: string;
}) {
  return (
    <ol className="relative mx-auto w-full max-w-2xl space-y-2">
      {nodes.map((node, index) => {
        const locked = node.status === "locked";
        const href = `/learn/${moduleId}/${node.id}`;
        const prereq =
          locked && index > 0
            ? `Finish “${nodes[index - 1]!.title}” first`
            : locked
              ? "Locked until earlier levels are complete"
              : null;
        const content = (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold text-[var(--jose-ink)]">
              {node.title}
            </span>
            <span className="text-sm text-[var(--jose-ink-muted)]">
              {node.status === "completed"
                ? node.kind === "lesson"
                  ? "Read again"
                  : "Review"
                : node.kind}
              {prereq ? ` · ${prereq}` : ""}
            </span>
          </span>
        );
        return (
          <li key={node.id} id={`node-${node.id}`}>
            {locked ? (
              <div className="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-3 opacity-80 ring-1 ring-black/5">
                <Lock className="size-4 shrink-0 text-stone-400" aria-hidden />
                {content}
              </div>
            ) : (
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ring-1 transition hover:bg-white ${
                  node.status === "current"
                    ? "bg-white ring-[var(--jose-accent)]"
                    : "bg-white/90 ring-black/5"
                }`}
              >
                {node.status === "completed" ? (
                  <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Compass className="size-4 shrink-0 text-teal-700" aria-hidden />
                )}
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
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
    const prev = points[i - 1]!;
    const curr = points[i]!;
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
          className="path-spine"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {nodes.map((node, i) => (
        <div
          key={node.id}
          id={`node-${node.id}`}
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
  viewMode,
  onViewMode,
  onJumpCurrent,
}: {
  path: PathResponse;
  active?: Section;
  viewMode: PathViewMode;
  onViewMode: (mode: PathViewMode) => void;
  onJumpCurrent: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--jose-rule)] bg-white/90 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
            <Compass className="size-4" strokeWidth={2.25} aria-hidden />
            Path
          </p>
          <button
            type="button"
            onClick={onJumpCurrent}
            className="text-xs font-semibold text-teal-800"
          >
            Jump to current
          </button>
        </div>
        <div
          role="group"
          aria-label="Path layout"
          className="mb-4 inline-flex rounded-xl border border-[var(--jose-rule)] p-1"
        >
          <button
            type="button"
            aria-pressed={viewMode === "map"}
            onClick={() => onViewMode("map")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              viewMode === "map"
                ? "bg-[var(--jose-ink)] text-white"
                : "text-stone-500"
            }`}
          >
            Map
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            onClick={() => onViewMode("list")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              viewMode === "list"
                ? "bg-[var(--jose-ink)] text-white"
                : "text-stone-500"
            }`}
          >
            List
          </button>
        </div>
        <ul className="space-y-2.5">
          {path.sections.map((section) => {
            const done = section.nodes.every((n) => n.status === "completed");
            const current = section.nodes.some((n) => n.status === "current");
            const isActive = active?.id === section.id;
            return (
              <li key={section.id}>
                <a
                  href={`#section-${section.id}`}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-stone-50 ${
                    isActive ? "bg-stone-50 ring-1 ring-black/5" : ""
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: section.themeColor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-stone-800">
                      {section.title}
                    </span>
                    <span className="block truncate text-sm text-stone-500">
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
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
        <Check className="size-4" strokeWidth={2.5} aria-hidden />
        Done
      </span>
    );
  }
  if (current) {
    return <span className="text-sm font-semibold text-teal-800">Now</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-400">
      <Lock className="size-3.5" strokeWidth={2.25} aria-hidden />
      Soon
    </span>
  );
}
