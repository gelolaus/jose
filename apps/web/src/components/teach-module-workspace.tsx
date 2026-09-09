"use client";

import { LessonBlocksView } from "@/components/lesson-blocks-view";
import { GameSwitch } from "@/components/game-player";
import { COVER_COLORS, FieldLabel, TeachTitle } from "@/components/teach-shell";
import { OverflowItem, OverflowMenu } from "@/components/teach-overflow-menu";
import { TeachOutlinePane, type OutlineSelection } from "@/components/teach-outline-pane";
import { TeachLevelEditor, type LevelDraft } from "@/components/teach-level-editor";
import { usePendingMap } from "@/lib/use-pending-map";
import {
  deleteTeachSection,
  duplicateTeachModule,
  duplicateTeachSection,
  extractPublishReadiness,
  fetchPublishReadiness,
  fetchTeachLevel,
  patchTeachModule,
  patchTeachSection,
  publishTeachModule,
  unpublishTeachModule,
} from "@/lib/path-api";
import type {
  PublishIssue,
  TeachLevelDetail,
  TeachModuleDetail,
} from "@jose/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Pane = "outline" | "edit" | "preview";
type Selection = OutlineSelection;
type PendingMap = ReturnType<typeof usePendingMap>;
type EditorGuard = { dirty: boolean; save: () => Promise<boolean> };
type LeaveTarget =
  | { kind: "selection"; selection: Selection; pane?: Pane }
  | { kind: "href"; href: string };

function firstLevelId(mod: TeachModuleDetail): string | undefined {
  for (const section of mod.sections) {
    if (section.levels[0]) return section.levels[0].id;
  }
  return undefined;
}

function defaultSelection(mod: TeachModuleDetail, initialLevelId?: string): Selection {
  if (initialLevelId) return { type: "level", levelId: initialLevelId };
  const id = firstLevelId(mod);
  if (id) return { type: "level", levelId: id };
  if (mod.sections[0]) return { type: "section", sectionId: mod.sections[0].id };
  return { type: "module" };
}

function selectionHref(moduleId: string, selection: Selection) {
  if (selection.type === "level") {
    return `/teach/modules/${moduleId}?level=${encodeURIComponent(selection.levelId)}`;
  }
  return `/teach/modules/${moduleId}`;
}

function previewLevel(
  level: TeachLevelDetail | null,
  draft: LevelDraft | null,
): TeachLevelDetail | null {
  if (!level || !draft || draft.id !== level.id) return level;
  return {
    ...level,
    title: draft.title,
    lesson:
      level.kind === "lesson" && level.lesson
        ? { ...level.lesson, blocks: draft.blocks }
        : level.lesson,
    game: draft.game ?? level.game,
  };
}

export function TeachModuleWorkspace({
  initial,
  initialLevelId,
}: {
  initial: TeachModuleDetail;
  initialLevelId?: string;
}) {
  const router = useRouter();
  const pending = usePendingMap();
  const [mod, setMod] = useState(initial);
  const [selection, setSelection] = useState<Selection>(() =>
    defaultSelection(initial, initialLevelId),
  );
  const [seenLevelId, setSeenLevelId] = useState(initialLevelId);
  if (initialLevelId !== seenLevelId) {
    setSeenLevelId(initialLevelId);
    if (initialLevelId) {
      setSelection({ type: "level", levelId: initialLevelId });
    }
  }
  const [pane, setPane] = useState<Pane>("edit");
  const [error, setError] = useState<string | null>(null);
  const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);
  const [opError, setOpError] = useState<Record<string, string>>({});
  const [level, setLevel] = useState<TeachLevelDetail | null>(null);
  const [levelLoading, setLevelLoading] = useState(false);
  const [levelDraft, setLevelDraft] = useState<LevelDraft | null>(null);
  const [leavePrompt, setLeavePrompt] = useState<LeaveTarget | null>(null);
  const guardRef = useRef<EditorGuard | null>(null);

  const onGuardChange = useCallback((guard: EditorGuard | null) => {
    guardRef.current = guard;
  }, []);

  const onDraftChange = useCallback((draft: LevelDraft) => {
    setLevelDraft(draft);
  }, []);

  function commitSelection(next: Selection, nextPane: Pane = "edit") {
    setSelection(next);
    setPane(nextPane);
    router.replace(selectionHref(mod.id, next), { scroll: false });
  }

  function commitLeave(target: LeaveTarget) {
    if (target.kind === "href") {
      router.push(target.href);
      return;
    }
    commitSelection(target.selection, target.pane ?? "edit");
  }

  function requestLeave(target: LeaveTarget) {
    if (guardRef.current?.dirty) {
      setLeavePrompt(target);
      return;
    }
    commitLeave(target);
  }

  function applySelection(next: Selection, nextPane: Pane = "edit") {
    requestLeave({ kind: "selection", selection: next, pane: nextPane });
  }

  useEffect(() => {
    if (initialLevelId) return;
    const id = firstLevelId(initial);
    if (!id) return;
    router.replace(
      `/teach/modules/${initial.id}?level=${encodeURIComponent(id)}`,
      { scroll: false },
    );
  }, [initial, initialLevelId, router]);

  async function runPublish() {
    setError(null);
    if (mod.published) {
      const result = await pending.run("publish", () => unpublishTeachModule(mod.id));
      if (result.ok) {
        setMod(result.data);
        setPublishIssues([]);
      } else setError(result.error);
      return;
    }
    const result = await pending.run("publish", async () => {
      const published = await publishTeachModule(mod.id);
      return published.module;
    });
    if (result.ok) {
      setMod(result.data);
      setPublishIssues([]);
      return;
    }
    setError(result.error);
    const readiness = extractPublishReadiness(new Error(result.error));
    if (readiness) {
      setPublishIssues(readiness.blockers);
    } else {
      try {
        const checked = await fetchPublishReadiness(mod.id);
        setPublishIssues(checked.blockers);
      } catch {
        setPublishIssues([]);
      }
    }
  }

  useEffect(() => {
    if (selection.type !== "level") {
      queueMicrotask(() => {
        setLevel(null);
        setLevelLoading(false);
        setLevelDraft(null);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLevelLoading(true);
    });
    void fetchTeachLevel(selection.levelId)
      .then((detail) => {
        if (!cancelled) setLevel(detail);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load level");
        }
      })
      .finally(() => {
        if (!cancelled) setLevelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--jose-rule)] bg-[var(--jose-paper)]/90 px-4 py-3 sm:px-6">
        <TeachTitle
          kicker={mod.published ? "Published" : "Draft"}
          title={mod.title}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/teach"
                className="inline-flex min-h-11 items-center text-sm font-extrabold text-[var(--jose-accent)]"
                onClick={(event) => {
                  if (!guardRef.current?.dirty) return;
                  event.preventDefault();
                  setLeavePrompt({ kind: "href", href: "/teach" });
                }}
              >
                All modules
              </Link>
              {pane !== "outline" ? (
                <button
                  type="button"
                  aria-label="Back to outline"
                  className="jose-button jose-button--secondary min-h-11 px-3 py-1.5 text-xs lg:hidden"
                  onClick={() => setPane("outline")}
                >
                  Back to outline
                </button>
              ) : null}
              <button
                type="button"
                className="jose-button jose-button--secondary min-h-11 px-3 py-1.5 text-xs"
                onClick={() => setPane(pane === "preview" ? "edit" : "preview")}
              >
                {pane === "preview" ? "Edit" : "Preview"}
              </button>
              <button
                type="button"
                disabled={pending.isPending("publish")}
                onClick={() => void runPublish()}
                className="jose-button min-h-11 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {mod.published ? "Unpublish" : "Publish"}
              </button>
              <OverflowMenu label="Module actions">
                <OverflowItem
                  disabled={pending.isPending("dup-module")}
                  onClick={() => {
                    void pending
                      .run("dup-module", () => duplicateTeachModule(mod.id))
                      .then((result) => {
                        if (result.ok) router.push(`/teach/modules/${result.data.id}`);
                        else setError(result.error);
                      });
                  }}
                >
                  Duplicate module
                </OverflowItem>
              </OverflowMenu>
            </div>
          }
        />
        {error ? <p className="mt-2 text-sm font-bold text-[var(--jose-coral)]">{error}</p> : null}
        {publishIssues.length > 0 ? (
          <div className="mt-3 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-100">
            <p className="text-sm font-extrabold text-rose-900">Could not publish yet</p>
            <ul className="mt-2 space-y-2">
              {publishIssues.map((issue) => (
                <li key={`${issue.code}-${issue.path}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (issue.levelId) {
                        applySelection({ type: "level", levelId: issue.levelId });
                      } else {
                        applySelection({ type: "module" });
                      }
                    }}
                    className="w-full rounded-xl bg-[var(--jose-paper)] px-3 py-2 text-left text-sm font-semibold text-rose-800"
                  >
                    {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {leavePrompt ? (
        <div className="border-b border-[var(--jose-rule)] bg-amber-50 px-4 py-3 sm:px-6">
          <p className="text-sm font-extrabold text-amber-950">Save your changes first?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="jose-button min-h-11 px-4 py-2 text-sm"
              onClick={async () => {
                const ok = await guardRef.current?.save();
                if (!ok) return;
                const next = leavePrompt;
                setLeavePrompt(null);
                commitLeave(next);
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="jose-button jose-button--secondary min-h-11 px-4 py-2 text-sm"
              onClick={() => {
                const next = leavePrompt;
                setLeavePrompt(null);
                guardRef.current = null;
                commitLeave(next);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className="min-h-11 px-4 py-2 text-sm font-extrabold text-[var(--jose-ink)]"
              onClick={() => setLeavePrompt(null)}
            >
              Stay
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside
          className={`min-h-0 overflow-y-auto border-r border-[var(--jose-rule)] bg-[var(--jose-paper)]/80 p-3 ${
            pane === "outline" ? "block" : "hidden lg:block"
          }`}
        >
          <TeachOutlinePane
            mod={mod}
            selection={selection}
            draftTitle={
              selection.type === "level" && levelDraft?.id === selection.levelId
                ? levelDraft.title
                : undefined
            }
            opError={opError}
            pending={pending}
            onSelect={(next) => applySelection(next)}
            onSelectLevel={(levelId) => applySelection({ type: "level", levelId })}
            onModuleChange={setMod}
            setOpError={setOpError}
          />
        </aside>

        <section
          className={`min-h-0 overflow-y-auto p-4 sm:p-5 ${
            pane === "outline" ? "hidden lg:block" : "block"
          }`}
          aria-label="Editor"
        >
          <p aria-live="polite" className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--jose-ink-muted)]">
            {selection.type === "level"
              ? `Editing lesson: ${level?.title ?? selection.levelId}`
              : selection.type === "section"
                ? "Editing section"
                : "Editing module"}
          </p>
          {pane === "preview" ? (
            <TeacherPreviewPane
              level={previewLevel(level, levelDraft)}
              loading={levelLoading}
              onBack={() => setPane("edit")}
            />
          ) : null}
          <div className={pane === "preview" ? "hidden" : undefined}>
            {selection.type === "module" ? (
              <ModuleEditorPane
                key={`${mod.id}-${mod.revision}`}
                mod={mod}
                onChange={setMod}
                setError={setError}
                pending={pending}
                issues={publishIssues}
                onJumpToLevel={(levelId) => applySelection({ type: "level", levelId })}
                onGuardChange={onGuardChange}
              />
            ) : null}
            {selection.type === "section" ? (
              <SectionEditorPane
                key={selection.sectionId}
                mod={mod}
                sectionId={selection.sectionId}
                onChange={setMod}
                setError={setError}
                opError={opError}
                setOpError={setOpError}
                pending={pending}
                onGuardChange={onGuardChange}
              />
            ) : null}
            {selection.type === "level" ? (
              levelLoading || !level ? (
                <p className="text-sm font-bold text-[var(--jose-ink-muted)]">Loading level…</p>
              ) : (
                <TeachLevelEditor
                  key={level.id}
                  moduleId={mod.id}
                  level={level}
                  onLevelChange={async (next) => {
                    setLevel((current) => {
                      if (current && current.id !== next.id) return current;
                      return next;
                    });
                  }}
                  onModuleChange={setMod}
                  onDraftChange={onDraftChange}
                  onGuardChange={onGuardChange}
                />
              )
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function TeacherPreviewPane({
  level,
  loading,
  onBack,
}: {
  level: TeachLevelDetail | null;
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-[var(--jose-ink-muted)]">
        Preview uses the student games but does not award XP, spend lives, or submit assignments.
      </p>
      <button type="button" onClick={onBack} className="jose-button jose-button--secondary">
        Back to editor
      </button>
      {loading || !level ? (
        <p className="text-sm font-bold text-[var(--jose-ink-muted)]">
          Select a lesson or game to preview.
        </p>
      ) : level.kind === "lesson" && level.lesson ? (
        <div className="learning-card rounded-2xl p-4">
          <h2 className="font-display text-2xl font-semibold">{level.title}</h2>
          <div className="mt-4">
            <LessonBlocksView lesson={level.lesson} />
          </div>
        </div>
      ) : level.kind === "game" && level.game ? (
        <div className="learning-card rounded-2xl p-4">
          <h2 className="mb-4 font-display text-2xl font-semibold">{level.title}</h2>
          <GameSwitch
            mode="play"
            game={level.game}
            onMiss={async () => "ok"}
            onFinish={() => undefined}
          />
        </div>
      ) : (
        <p className="text-sm font-bold text-[var(--jose-ink-muted)]">This item has no preview yet.</p>
      )}
    </div>
  );
}

function ModuleEditorPane({
  mod,
  onChange,
  setError,
  pending,
  issues,
  onJumpToLevel,
  onGuardChange,
}: {
  mod: TeachModuleDetail;
  onChange: (mod: TeachModuleDetail) => void;
  setError: (value: string | null) => void;
  pending: PendingMap;
  issues: PublishIssue[];
  onJumpToLevel: (levelId: string) => void;
  onGuardChange: (guard: EditorGuard | null) => void;
}) {
  const [title, setTitle] = useState(mod.title);
  const [subtitle, setSubtitle] = useState(mod.subtitle);
  const [coverColor, setCoverColor] = useState(mod.coverColor);
  const [objectives, setObjectives] = useState(mod.objectives ?? "");
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({
      title: mod.title,
      subtitle: mod.subtitle,
      coverColor: mod.coverColor,
      objectives: mod.objectives ?? "",
    }),
  );
  const draft = JSON.stringify({ title, subtitle, coverColor, objectives });
  const dirty = draft !== baseline;

  const save = useCallback(async () => {
    const result = await pending.run("save-module", () =>
      patchTeachModule(mod.id, {
        title,
        subtitle,
        coverColor,
        objectives: objectives.trim() || null,
        expectedRevision: mod.revision,
      }),
    );
    if (result.ok) {
      onChange(result.data);
      setBaseline(JSON.stringify({
        title: result.data.title,
        subtitle: result.data.subtitle,
        coverColor: result.data.coverColor,
        objectives: result.data.objectives ?? "",
      }));
      return true;
    }
    setError(result.error);
    return false;
  }, [coverColor, mod.id, mod.revision, objectives, onChange, pending, setError, subtitle, title]);

  useEffect(() => {
    onGuardChange({ dirty, save });
    return () => onGuardChange(null);
  }, [dirty, onGuardChange, save]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={!dirty || pending.isPending("save-module")}
        onClick={() => void save()}
        className="jose-button disabled:opacity-50"
      >
        Save
      </button>
      <FieldLabel>Title</FieldLabel>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-2xl bg-[var(--jose-paper)] px-4 py-3 font-bold ring-1 ring-[var(--jose-rule)]"
      />
      <FieldLabel>Subtitle / objective line</FieldLabel>
      <input
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full rounded-2xl bg-[var(--jose-paper)] px-4 py-3 font-bold ring-1 ring-[var(--jose-rule)]"
      />
      <FieldLabel>Chapter objectives</FieldLabel>
      <textarea
        value={objectives}
        onChange={(e) => setObjectives(e.target.value)}
        rows={3}
        className="w-full rounded-2xl bg-[var(--jose-paper)] px-4 py-3 font-bold ring-1 ring-[var(--jose-rule)]"
        placeholder="What should students understand after this module?"
      />
      <div className="flex flex-wrap gap-2">
        {COVER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => setCoverColor(color)}
            className={`size-9 rounded-2xl ring-2 ${
              coverColor === color ? "ring-[var(--jose-ink)]" : "ring-transparent"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      {issues.length > 0 ? (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li key={`${issue.code}-${issue.path}`}>
              <button
                type="button"
                onClick={() => {
                  if (issue.levelId) onJumpToLevel(issue.levelId);
                }}
                className="w-full rounded-xl bg-rose-50 px-3 py-2 text-left text-sm font-semibold text-rose-800"
              >
                {issue.message}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SectionEditorPane({
  mod,
  sectionId,
  onChange,
  setError,
  opError,
  setOpError,
  pending,
  onGuardChange,
}: {
  mod: TeachModuleDetail;
  sectionId: string;
  onChange: (mod: TeachModuleDetail) => void;
  setError: (value: string | null) => void;
  opError: Record<string, string>;
  setOpError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: PendingMap;
  onGuardChange: (guard: EditorGuard | null) => void;
}) {
  const section = mod.sections.find((item) => item.id === sectionId);
  const [title, setTitle] = useState(section?.title ?? "");
  const [subtitle, setSubtitle] = useState(section?.subtitle ?? "");
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({ title: section?.title ?? "", subtitle: section?.subtitle ?? "" }),
  );
  const dirty = JSON.stringify({ title, subtitle }) !== baseline;

  const save = useCallback(async () => {
    if (!section) return false;
    const key = `save-section-${section.id}`;
    const result = await pending.run(key, () =>
      patchTeachSection(section.id, { title, subtitle }),
    );
    if (result.ok) {
      onChange(result.data);
      setBaseline(JSON.stringify({ title, subtitle }));
      setOpError((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return true;
    }
    setOpError((prev) => ({ ...prev, [key]: result.error }));
    return false;
  }, [onChange, pending, section, setOpError, subtitle, title]);

  useEffect(() => {
    onGuardChange({ dirty, save });
    return () => onGuardChange(null);
  }, [dirty, onGuardChange, save]);

  if (!section) return <p className="text-sm font-bold text-[var(--jose-coral)]">Section missing</p>;

  return (
    <div className="space-y-3">
      <FieldLabel>Section title</FieldLabel>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-2xl bg-[var(--jose-paper)] px-4 py-3 font-bold ring-1 ring-[var(--jose-rule)]"
      />
      <FieldLabel>Subtitle</FieldLabel>
      <input
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full rounded-2xl bg-[var(--jose-paper)] px-4 py-3 font-bold ring-1 ring-[var(--jose-rule)]"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dirty || pending.isPending(`save-section-${section.id}`)}
          onClick={() => void save()}
          className="jose-button disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          disabled={pending.isPending(`dup-section-${section.id}`)}
          onClick={async () => {
            const result = await pending.run(`dup-section-${section.id}`, () =>
              duplicateTeachSection(section.id),
            );
            if (result.ok) onChange(result.data);
            else setError(result.error);
          }}
          className="jose-button jose-button--secondary"
        >
          Duplicate section
        </button>
        {mod.sections.length > 1 ? (
          <button
            type="button"
            disabled={pending.isPending(`del-section-${section.id}`)}
            onClick={async () => {
              if (!window.confirm("Delete this section and its levels?")) return;
              const result = await pending.run(`del-section-${section.id}`, () =>
                deleteTeachSection(section.id),
              );
              if (result.ok) onChange(result.data);
              else setError(result.error);
            }}
            className="min-h-11 rounded-full bg-rose-50 px-4 py-2 text-sm font-extrabold text-rose-700"
          >
            Delete section
          </button>
        ) : null}
      </div>
      {opError[`save-section-${section.id}`] ? (
        <p className="text-sm font-bold text-[var(--jose-coral)]">
          {opError[`save-section-${section.id}`]}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer TeachModuleWorkspace */
export function TeachModuleEditor({ initial }: { initial: TeachModuleDetail }) {
  return <TeachModuleWorkspace initial={initial} />;
}
