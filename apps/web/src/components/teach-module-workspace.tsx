"use client";

import { GameEditor } from "@/components/teach-game-editor";
import { LessonBlocksEditor } from "@/components/lesson-blocks-editor";
import { LessonBlocksView } from "@/components/lesson-blocks-view";
import { COVER_COLORS, FieldLabel, TeachTitle } from "@/components/teach-shell";
import { usePendingMap } from "@/lib/use-pending-map";
import { useDraftAutosave } from "@/lib/use-draft-autosave";
import {
  applyTeachTemplate,
  createTeachLevel,
  createTeachSection,
  deleteTeachLevel,
  deleteTeachSection,
  duplicateTeachLevel,
  duplicateTeachModule,
  duplicateTeachSection,
  extractPublishReadiness,
  fetchPublishReadiness,
  fetchTeachLevel,
  fetchTeachModule,
  importTeachQuestions,
  moveTeachLevel,
  patchTeachLevel,
  patchTeachModule,
  patchTeachSection,
  publishTeachModule,
  putTeachGame,
  putTeachLesson,
  unpublishTeachModule,
} from "@/lib/path-api";
import type {
  GameContent,
  GameType,
  LessonBlocks,
  ModuleTemplateId,
  PublishIssue,
  TeachLevelDetail,
  TeachModuleDetail,
} from "@jose/shared";
import { markdownToStarterBlocks } from "@jose/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const GAME_TYPES: { id: GameType; label: string }[] = [
  { id: "quiz", label: "Evidence duel" },
  { id: "memory", label: "Archive match" },
  { id: "timeline", label: "Cause & consequence" },
  { id: "blank", label: "Restore the passage" },
  { id: "sort", label: "Curator's desk" },
  { id: "case-files", label: "Case Files" },
  { id: "dispatches", label: "Dispatches" },
  { id: "editorial", label: "Editorial Room" },
  { id: "dapitan", label: "Dapitan Workshop" },
];

const TEMPLATES: { id: ModuleTemplateId; label: string }[] = [
  { id: "lesson-retrieval", label: "Lesson + retrieval" },
  { id: "source-investigation", label: "Source investigation" },
  { id: "timeline", label: "Timeline" },
  { id: "chapter-checkpoint", label: "Chapter checkpoint" },
];

type Pane = "outline" | "edit" | "preview";
type Selection =
  | { type: "module" }
  | { type: "section"; sectionId: string }
  | { type: "level"; levelId: string };

type PendingMap = ReturnType<typeof usePendingMap>;

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
  const [selection, setSelection] = useState<Selection>(
    initialLevelId
      ? { type: "level", levelId: initialLevelId }
      : { type: "module" },
  );
  const [pane, setPane] = useState<Pane>("edit");
  const [error, setError] = useState<string | null>(null);
  const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);
  const [opError, setOpError] = useState<Record<string, string>>({});
  const [level, setLevel] = useState<TeachLevelDetail | null>(null);
  const [levelLoading, setLevelLoading] = useState(false);

  async function reloadModule() {
    setMod(await fetchTeachModule(mod.id));
  }

  useEffect(() => {
    if (selection.type !== "level") {
      // Clear the loaded level when leaving level selection.
      queueMicrotask(() => {
        setLevel(null);
        setLevelLoading(false);
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

  const validation = useMemo(() => validateModule(mod, level), [mod, level]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-black/5 bg-white/90 px-4 py-3 sm:px-6">
        <TeachTitle
          kicker={mod.published ? "Published" : "Draft"}
          title={mod.title}
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/teach" className="text-sm font-extrabold text-teal-800">
                All modules
              </Link>
              <a
                href={`/learn/${mod.id}`}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
              >
                Playtest path
              </a>
            </div>
          }
        />
        <div className="mt-2 flex gap-2 lg:hidden" role="tablist" aria-label="Workspace panes">
          {(["outline", "edit", "preview"] as Pane[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pane === id}
              onClick={() => setPane(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${
                pane === id ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
        {error ? <p className="mt-2 text-sm font-bold text-rose-600">{error}</p> : null}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[16rem_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <aside
          className={`min-h-0 overflow-y-auto border-r border-black/5 bg-white/80 p-3 ${
            pane === "outline" ? "block" : "hidden lg:block"
          }`}
        >
          <OutlinePane
            mod={mod}
            selection={selection}
            opError={opError}
            pending={pending}
            onSelect={setSelection}
            onSelectLevel={(levelId) => {
              setSelection({ type: "level", levelId });
              setPane("edit");
            }}
            onModuleChange={setMod}
            setOpError={setOpError}
            setError={setError}
            onDuplicatedModule={(id) => router.push(`/teach/modules/${id}`)}
          />
        </aside>

        <section
          className={`min-h-0 overflow-y-auto p-4 sm:p-5 ${
            pane === "edit" ? "block" : "hidden lg:block"
          }`}
        >
          {selection.type === "module" ? (
            <ModuleEditorPane
              key={`${mod.id}-${mod.revision}`}
              mod={mod}
              onChange={setMod}
              setError={setError}
              pending={pending}
              issues={publishIssues}
              onIssues={setPublishIssues}
              onJumpToLevel={(levelId) => {
                setSelection({ type: "level", levelId });
                setPane("edit");
              }}
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
            />
          ) : null}
          {selection.type === "level" ? (
            levelLoading || !level ? (
              <p className="text-sm font-bold text-slate-500">Loading level…</p>
            ) : (
              <LevelEditorPane
                key={`${level.id}-${level.revision}`}
                moduleId={mod.id}
                level={level}
                onLevelChange={async (next) => {
                  setLevel(next);
                  await reloadModule();
                }}
                onModuleChange={setMod}
              />
            )
          ) : null}
        </section>

        <aside
          className={`min-h-0 overflow-y-auto border-l border-black/5 bg-slate-50/80 p-4 ${
            pane === "preview" ? "block" : "hidden lg:block"
          }`}
        >
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Preview / validation
          </p>
          <ul className="mt-3 space-y-2">
            {publishIssues.map((issue) => (
              <li key={`${issue.code}-${issue.path}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (issue.levelId) {
                      setSelection({ type: "level", levelId: issue.levelId });
                      setPane("edit");
                    } else {
                      setSelection({ type: "module" });
                      setPane("edit");
                    }
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ring-1 ${
                    issue.severity === "blocker"
                      ? "bg-rose-50 text-rose-800 ring-rose-100"
                      : "bg-amber-50 text-amber-900 ring-amber-100"
                  }`}
                >
                  {issue.message}
                </button>
              </li>
            ))}
            {validation.map((item) => (
              <li
                key={item}
                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-black/5"
              >
                {item}
              </li>
            ))}
          </ul>
          {level?.kind === "lesson" && level.lesson ? (
            <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <LessonBlocksView lesson={level.lesson} />
            </div>
          ) : null}
          {level?.kind === "game" && level.game ? (
            <div className="mt-5 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700 ring-1 ring-black/5">
              <p className="font-extrabold text-slate-800">
                {level.game.type} playtest lives in the editor Playtest tab.
              </p>
              <p className="mt-2">
                Open the level editor to build and play without leaving the workspace.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function OutlinePane({
  mod,
  selection,
  opError,
  pending,
  onSelect,
  onSelectLevel,
  onModuleChange,
  setOpError,
  setError,
  onDuplicatedModule,
}: {
  mod: TeachModuleDetail;
  selection: Selection;
  opError: Record<string, string>;
  pending: PendingMap;
  onSelect: (selection: Selection) => void;
  onSelectLevel: (levelId: string) => void;
  onModuleChange: (mod: TeachModuleDetail) => void;
  setOpError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setError: (value: string | null) => void;
  onDuplicatedModule: (id: string) => void;
}) {
  const [addTitle, setAddTitle] = useState("");
  const [addKind, setAddKind] = useState<"lesson" | "game">("lesson");
  const [addGameType, setAddGameType] = useState<GameType>("quiz");
  const [sectionTitle, setSectionTitle] = useState("");
  const activeSectionId =
    selection.type === "section"
      ? selection.sectionId
      : selection.type === "level"
        ? mod.sections.find((s) => s.levels.some((l) => l.id === selection.levelId))?.id
        : mod.sections[0]?.id;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onSelect({ type: "module" })}
        className={`w-full rounded-2xl px-3 py-2 text-left text-sm font-extrabold ${
          selection.type === "module" ? "bg-teal-100 text-teal-900" : "hover:bg-slate-50"
        }`}
      >
        Module details
      </button>

      <div className="space-y-2">
        <p className="px-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">
          Templates
        </p>
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={pending.isPending(`template-${template.id}`)}
            onClick={async () => {
              const key = `template-${template.id}`;
              const result = await pending.run(key, () =>
                applyTeachTemplate(mod.id, {
                  templateId: template.id,
                  replaceEmptyStarter: false,
                }),
              );
              if (result.ok) {
                onModuleChange(result.data);
                setOpError((prev) => {
                  const next = { ...prev };
                  delete next[key];
                  return next;
                });
              } else {
                setOpError((prev) => ({ ...prev, [key]: result.error }));
              }
            }}
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-700 ring-1 ring-black/5 disabled:opacity-50"
          >
            Add {template.label}
          </button>
        ))}
        {opError[`template-lesson-retrieval`] ? (
          <p className="text-xs font-bold text-rose-600">
            {opError[`template-lesson-retrieval`]}
          </p>
        ) : null}
      </div>

      {mod.sections.map((section) => (
        <div key={section.id} className="space-y-1">
          <button
            type="button"
            onClick={() => onSelect({ type: "section", sectionId: section.id })}
            className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-extrabold ${
              selection.type === "section" && selection.sectionId === section.id
                ? "bg-teal-100 text-teal-900"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: section.themeColor }}
            />
            {section.title}
          </button>
          <ul className="space-y-1 pl-3">
            {section.levels.map((level, index) => (
              <li key={level.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => onSelectLevel(level.id)}
                  className={`w-full rounded-xl px-2 py-1.5 text-left text-sm font-bold ${
                    selection.type === "level" && selection.levelId === level.id
                      ? "bg-teal-700 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {level.title}
                  <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-wide opacity-70">
                    {level.kind}
                    {level.gameType ? ` · ${level.gameType}` : ""}
                  </span>
                </button>
                <div className="flex flex-wrap gap-1 pl-1">
                  <OpButton
                    label="Up"
                    disabled={index === 0}
                    pending={pending}
                    pendingKey={`move-up-${level.id}`}
                    error={opError[`move-up-${level.id}`]}
                    onClick={async () => {
                      const key = `move-up-${level.id}`;
                      const result = await pending.run(key, () =>
                        moveTeachLevel(level.id, "up"),
                      );
                      if (result.ok) {
                        onModuleChange(result.data);
                        setOpError((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      } else {
                        setOpError((prev) => ({ ...prev, [key]: result.error }));
                      }
                    }}
                  />
                  <OpButton
                    label="Down"
                    disabled={index === section.levels.length - 1}
                    pending={pending}
                    pendingKey={`move-down-${level.id}`}
                    error={opError[`move-down-${level.id}`]}
                    onClick={async () => {
                      const key = `move-down-${level.id}`;
                      const result = await pending.run(key, () =>
                        moveTeachLevel(level.id, "down"),
                      );
                      if (result.ok) {
                        onModuleChange(result.data);
                        setOpError((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      } else {
                        setOpError((prev) => ({ ...prev, [key]: result.error }));
                      }
                    }}
                  />
                  <OpButton
                    label="Dup"
                    pending={pending}
                    pendingKey={`dup-level-${level.id}`}
                    error={opError[`dup-level-${level.id}`]}
                    onClick={async () => {
                      const key = `dup-level-${level.id}`;
                      const result = await pending.run(key, () =>
                        duplicateTeachLevel(level.id),
                      );
                      if (result.ok) {
                        onModuleChange(await fetchTeachModule(mod.id));
                        onSelectLevel(result.data.id);
                        setOpError((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      } else {
                        setOpError((prev) => ({ ...prev, [key]: result.error }));
                      }
                    }}
                  />
                  <OpButton
                    label="Del"
                    pending={pending}
                    pendingKey={`del-level-${level.id}`}
                    error={opError[`del-level-${level.id}`]}
                    onClick={async () => {
                      if (!window.confirm(`Delete “${level.title}”?`)) return;
                      const key = `del-level-${level.id}`;
                      const result = await pending.run(key, async () => {
                        await deleteTeachLevel(level.id);
                        return fetchTeachModule(mod.id);
                      });
                      if (result.ok) {
                        onModuleChange(result.data);
                        onSelect({ type: "module" });
                      } else {
                        setOpError((prev) => ({ ...prev, [key]: result.error }));
                      }
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {activeSectionId ? (
        <form
          className="space-y-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-black/5"
          onSubmit={async (e) => {
            e.preventDefault();
            const key = `add-level-${activeSectionId}`;
            const title = addTitle;
            const result = await pending.run(key, () =>
              createTeachLevel(activeSectionId, {
                title,
                kind: addKind,
                gameType: addKind === "game" ? addGameType : undefined,
              }),
            );
            if (result.ok) {
              setAddTitle("");
              onModuleChange(await fetchTeachModule(mod.id));
              onSelectLevel(result.data.id);
              setOpError((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            } else {
              setOpError((prev) => ({ ...prev, [key]: result.error }));
            }
          }}
        >
          <p className="text-xs font-extrabold text-slate-500">Add level</p>
          <input
            required
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-black/10"
          />
          <div className="flex gap-2">
            <select
              value={addKind}
              onChange={(e) => setAddKind(e.target.value as "lesson" | "game")}
              className="rounded-xl bg-white px-2 py-2 text-sm font-bold"
            >
              <option value="lesson">Lesson</option>
              <option value="game">Game</option>
            </select>
            {addKind === "game" ? (
              <select
                value={addGameType}
                onChange={(e) => setAddGameType(e.target.value as GameType)}
                className="rounded-xl bg-white px-2 py-2 text-sm font-bold"
              >
                {GAME_TYPES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={pending.isPending(`add-level-${activeSectionId}`)}
            className="rounded-full bg-teal-700 px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
          >
            {pending.isPending(`add-level-${activeSectionId}`) ? "Adding…" : "Add"}
          </button>
          {opError[`add-level-${activeSectionId}`] ? (
            <p className="text-xs font-bold text-rose-600">
              {opError[`add-level-${activeSectionId}`]}
            </p>
          ) : null}
        </form>
      ) : null}

      <form
        className="space-y-2 rounded-2xl border border-dashed border-slate-300 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const key = "add-section";
          const title = sectionTitle;
          const result = await pending.run(key, () =>
            createTeachSection(mod.id, {
              title,
              subtitle: "Deep dive",
              themeColor: mod.coverColor,
            }),
          );
          if (result.ok) {
            setSectionTitle("");
            onModuleChange(result.data);
            setOpError((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          } else {
            setOpError((prev) => ({ ...prev, [key]: result.error }));
          }
        }}
      >
        <p className="text-xs font-extrabold text-slate-500">Add section</p>
        <input
          required
          value={sectionTitle}
          onChange={(e) => setSectionTitle(e.target.value)}
          placeholder="Section title"
          className="w-full rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-black/10"
        />
        <button
          type="submit"
          disabled={pending.isPending("add-section")}
          className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
        >
          Add section
        </button>
        {opError["add-section"] ? (
          <p className="text-xs font-bold text-rose-600">{opError["add-section"]}</p>
        ) : null}
      </form>

      <button
        type="button"
        disabled={pending.isPending("dup-module")}
        onClick={async () => {
          const result = await pending.run("dup-module", () =>
            duplicateTeachModule(mod.id),
          );
          if (result.ok) onDuplicatedModule(result.data.id);
          else setError(result.error);
        }}
        className="w-full rounded-full bg-white px-3 py-2 text-xs font-extrabold text-slate-700 ring-1 ring-black/10 disabled:opacity-50"
      >
        Duplicate module
      </button>
    </div>
  );
}

function OpButton({
  label,
  onClick,
  disabled,
  pending,
  pendingKey,
  error,
}: {
  label: string;
  onClick: () => Promise<void>;
  disabled?: boolean;
  pending: PendingMap;
  pendingKey: string;
  error?: string;
}) {
  return (
    <div>
      <button
        type="button"
        disabled={disabled || pending.isPending(pendingKey)}
        onClick={() => void onClick()}
        className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-slate-600 ring-1 ring-black/10 disabled:opacity-40"
      >
        {pending.isPending(pendingKey) ? "…" : label}
      </button>
      {error ? <p className="text-[10px] font-bold text-rose-600">{error}</p> : null}
    </div>
  );
}

function ModuleEditorPane({
  mod,
  onChange,
  setError,
  pending,
  issues,
  onIssues,
  onJumpToLevel,
}: {
  mod: TeachModuleDetail;
  onChange: (mod: TeachModuleDetail) => void;
  setError: (value: string | null) => void;
  pending: PendingMap;
  issues: PublishIssue[];
  onIssues: (issues: PublishIssue[]) => void;
  onJumpToLevel: (levelId: string) => void;
}) {
  const [title, setTitle] = useState(mod.title);
  const [subtitle, setSubtitle] = useState(mod.subtitle);
  const [coverColor, setCoverColor] = useState(mod.coverColor);
  const [objectives, setObjectives] = useState(mod.objectives ?? "");

  const draft = useMemo(
    () => ({ title, subtitle, coverColor, objectives: objectives.trim() || null }),
    [title, subtitle, coverColor, objectives],
  );

  const autosave = useDraftAutosave({
    storageKey: `jose-teach-module-${mod.id}`,
    value: draft,
    revision: mod.revision,
    save: async (value, revision) => {
      const saved = await patchTeachModule(mod.id, {
        ...value,
        expectedRevision: revision,
      });
      onChange(saved);
      return { revision: saved.revision };
    },
    onConflict: (err) => setError(err instanceof Error ? err.message : "Conflict"),
  });

  return (
    <div className="space-y-4">
      <SaveStatusBanner status={autosave.status} error={autosave.error} onRetry={() => void autosave.saveNow()} />
      {autosave.recovered ? (
        <RecoveryBanner
          onAccept={() => {
            const recovered = autosave.acceptRecovery();
            if (!recovered) return;
            setTitle(recovered.title);
            setSubtitle(recovered.subtitle);
            setCoverColor(recovered.coverColor);
            if ("objectives" in recovered) {
              setObjectives(recovered.objectives ?? "");
            }
          }}
          onDiscard={() => autosave.discardRecovery()}
        />
      ) : null}
      <FieldLabel>Title</FieldLabel>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Subtitle / objective line</FieldLabel>
      <input
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Chapter objectives</FieldLabel>
      <textarea
        value={objectives}
        onChange={(e) => setObjectives(e.target.value)}
        rows={3}
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
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
              coverColor === color ? "ring-slate-800" : "ring-transparent"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void autosave.saveNow()}
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-extrabold text-white"
        >
          Save now
        </button>
        <button
          type="button"
          disabled={pending.isPending("publish")}
          onClick={async () => {
            if (mod.published) {
              const result = await pending.run("publish", () => unpublishTeachModule(mod.id));
              if (result.ok) {
                onChange(result.data);
                onIssues([]);
              } else setError(result.error);
              return;
            }
            const result = await pending.run("publish", async () => {
              const published = await publishTeachModule(mod.id);
              return published.module;
            });
            if (result.ok) {
              onChange(result.data);
              onIssues([]);
            } else {
              setError(result.error);
              const readiness = extractPublishReadiness(
                // pending.run wraps Error messages; re-fetch readiness for field links
                new Error(result.error),
              );
              if (readiness) {
                onIssues([...readiness.blockers, ...readiness.warnings]);
              } else {
                try {
                  const checked = await fetchPublishReadiness(mod.id);
                  onIssues([...checked.blockers, ...checked.warnings]);
                } catch {
                  onIssues([]);
                }
              }
            }
          }}
          className="rounded-full bg-teal-100 px-4 py-2 text-sm font-extrabold text-teal-900 disabled:opacity-50"
        >
          {mod.published ? "Unpublish" : "Publish"}
        </button>
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
}: {
  mod: TeachModuleDetail;
  sectionId: string;
  onChange: (mod: TeachModuleDetail) => void;
  setError: (value: string | null) => void;
  opError: Record<string, string>;
  setOpError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pending: PendingMap;
}) {
  const section = mod.sections.find((item) => item.id === sectionId);
  const [title, setTitle] = useState(section?.title ?? "");
  const [subtitle, setSubtitle] = useState(section?.subtitle ?? "");

  if (!section) return <p className="text-sm font-bold text-rose-600">Section missing</p>;

  return (
    <div className="space-y-3">
      <FieldLabel>Section title</FieldLabel>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Subtitle</FieldLabel>
      <input
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending.isPending(`save-section-${section.id}`)}
          onClick={async () => {
            const key = `save-section-${section.id}`;
            const result = await pending.run(key, () =>
              patchTeachSection(section.id, { title, subtitle }),
            );
            if (result.ok) {
              onChange(result.data);
              setOpError((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            } else {
              setOpError((prev) => ({ ...prev, [key]: result.error }));
            }
          }}
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
        >
          Save section
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
          className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-700 ring-1 ring-black/10"
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
            className="rounded-full bg-rose-50 px-4 py-2 text-sm font-extrabold text-rose-700"
          >
            Delete section
          </button>
        ) : null}
      </div>
      {opError[`save-section-${section.id}`] ? (
        <p className="text-sm font-bold text-rose-600">
          {opError[`save-section-${section.id}`]}
        </p>
      ) : null}
    </div>
  );
}

function LevelEditorPane({
  moduleId,
  level,
  onLevelChange,
  onModuleChange,
}: {
  moduleId: string;
  level: TeachLevelDetail;
  onLevelChange: (level: TeachLevelDetail) => Promise<void>;
  onModuleChange: (mod: TeachModuleDetail) => void;
}) {
  const [title, setTitle] = useState(level.title);
  const [blocks, setBlocks] = useState<LessonBlocks>(
    level.lesson?.blocks ?? markdownToStarterBlocks(level.lesson?.markdown ?? ""),
  );
  const [game, setGame] = useState<GameContent | null>(level.game);
  const [conflict, setConflict] = useState<string | null>(null);

  const lessonDraft = useMemo(() => ({ title, blocks }), [title, blocks]);
  const gameDraft = useMemo(
    () => ({ title, game }),
    [title, game],
  );

  const lessonAutosave = useDraftAutosave({
    storageKey: `jose-teach-level-lesson-${level.id}`,
    value: lessonDraft,
    revision: level.revision,
    enabled: level.kind === "lesson",
    save: async (value, revision) => {
      const titled = await patchTeachLevel(level.id, {
        title: value.title,
        expectedRevision: revision,
      });
      const saved = await putTeachLesson(level.id, {
        blocks: value.blocks,
        expectedRevision: titled.revision,
      });
      await onLevelChange(saved);
      onModuleChange(await fetchTeachModule(moduleId));
      return { revision: saved.revision };
    },
    onConflict: (err) =>
      setConflict(err instanceof Error ? err.message : "Conflict — reload to resolve"),
  });

  const gameAutosave = useDraftAutosave({
    storageKey: `jose-teach-level-game-${level.id}`,
    value: gameDraft,
    revision: level.revision,
    enabled: level.kind === "game" && Boolean(game),
    save: async (value, revision) => {
      if (!value.game) throw new Error("Missing game content");
      const titled = await patchTeachLevel(level.id, {
        title: value.title,
        expectedRevision: revision,
      });
      const saved = await putTeachGame(level.id, {
        ...value.game,
        expectedRevision: titled.revision,
      });
      await onLevelChange(saved);
      onModuleChange(await fetchTeachModule(moduleId));
      return { revision: saved.revision };
    },
    onConflict: (err) =>
      setConflict(err instanceof Error ? err.message : "Conflict — reload to resolve"),
  });

  const autosave = level.kind === "lesson" ? lessonAutosave : gameAutosave;

  return (
    <div className="space-y-4">
      <SaveStatusBanner
        status={autosave.status}
        error={autosave.error ?? conflict}
        onRetry={() => void autosave.saveNow()}
      />
      {autosave.recovered ? (
        <RecoveryBanner
          onAccept={() => {
            const recovered = autosave.acceptRecovery() as
              | { title: string; blocks?: LessonBlocks; game?: GameContent | null }
              | null;
            if (!recovered) return;
            setTitle(recovered.title);
            if (recovered.blocks) setBlocks(recovered.blocks);
            if (recovered.game !== undefined) setGame(recovered.game ?? null);
          }}
          onDiscard={() => autosave.discardRecovery()}
        />
      ) : null}
      {conflict ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {conflict}
          <button
            type="button"
            className="ml-3 underline"
            onClick={async () => {
              const fresh = await fetchTeachLevel(level.id);
              await onLevelChange(fresh);
              setConflict(null);
            }}
          >
            Reload server version
          </button>
        </div>
      ) : null}
      <FieldLabel>Level title</FieldLabel>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      {level.kind === "lesson" ? (
        <LessonBlocksEditor
          moduleId={moduleId}
          blocks={blocks}
          onChange={setBlocks}
          disabled={autosave.status === "saving"}
        />
      ) : null}
      {level.kind === "game" && game ? (
        <>
          <GameEditor
            game={game}
            onChange={setGame}
            onSave={async (next) => {
              setGame(next);
              const saved = await putTeachGame(level.id, {
                ...next,
                expectedRevision: level.revision,
              });
              await onLevelChange(saved);
            }}
          />
          {game.type === "quiz" ? (
            <QuestionImportPanel
              levelId={level.id}
              onImported={async (next) => {
                await onLevelChange(next);
                setGame(next.game);
              }}
            />
          ) : null}
        </>
      ) : null}
      {level.kind === "game" && level.gameType ? (
        <a
          href={`/learn/${moduleId}/level/${level.id}`}
          className="inline-flex rounded-full bg-teal-700 px-4 py-2 text-sm font-extrabold text-white"
        >
          Playtest this level
        </a>
      ) : null}
      {level.kind === "lesson" ? (
        <a
          href={`/learn/${moduleId}/level/${level.id}`}
          className="inline-flex rounded-full bg-teal-700 px-4 py-2 text-sm font-extrabold text-white"
        >
          Playtest this lesson
        </a>
      ) : null}
    </div>
  );
}

function QuestionImportPanel({
  levelId,
  onImported,
}: {
  levelId: string;
  onImported: (level: TeachLevelDetail) => Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [mode, setMode] = useState<"all-or-nothing" | "partial">("all-or-nothing");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof importTeachQuestions>
  > | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-black/5">
      <p className="text-sm font-extrabold text-slate-800">Bulk question import</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">
        Preview validates every row before commit. Choose all-or-nothing or partial.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as "csv" | "json")}
          className="rounded-xl bg-white px-3 py-2 text-sm font-bold"
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <select
          value={mode}
          onChange={(e) =>
            setMode(e.target.value as "all-or-nothing" | "partial")
          }
          className="rounded-xl bg-white px-3 py-2 text-sm font-bold"
        >
          <option value="all-or-nothing">All or nothing</option>
          <option value="partial">Partial import</option>
        </select>
      </div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={6}
        placeholder={
          format === "csv"
            ? "prompt,choiceA,choiceB,choiceC,choiceD,correct,why"
            : '[{"prompt":"...","choiceA":"...","choiceB":"...","correct":"A"}]'
        }
        className="mt-3 w-full rounded-2xl bg-white px-3 py-2 font-mono text-xs ring-1 ring-black/10"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setPreview(
                await importTeachQuestions(levelId, {
                  mode,
                  format,
                  raw,
                  commit: false,
                }),
              );
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-slate-700 ring-1 ring-black/10"
        >
          Preview
        </button>
        <button
          type="button"
          disabled={busy || !preview || (mode === "all-or-nothing" && preview.errorCount > 0)}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await importTeachQuestions(levelId, {
                mode,
                format,
                raw,
                commit: true,
              });
              setPreview(result);
              if (result.applied && result.level) {
                await onImported(result.level as TeachLevelDetail);
              }
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-full bg-teal-700 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
        >
          Commit import
        </button>
      </div>
      {preview ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-bold text-slate-700">
            {preview.validCount}/{preview.totalRows} valid · {preview.errorCount} errors · mode{" "}
            {preview.mode}
          </p>
          {preview.errors.map((err) => (
            <p key={`${err.row}-${err.message}`} className="font-semibold text-rose-600">
              Row {err.row}
              {err.field ? ` · ${err.field}` : ""}: {err.message}
            </p>
          ))}
          {preview.preview?.slice(0, 3).map((q) => (
            <p key={q.prompt} className="font-semibold text-slate-600">
              {q.prompt}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SaveStatusBanner({
  status,
  error,
  onRetry,
}: {
  status: string;
  error: string | null;
  onRetry: () => void;
}) {
  const label: Record<string, string> = {
    idle: "Ready",
    dirty: "Unsaved changes",
    saving: "Saving…",
    saved: "Saved",
    offline: "Offline — draft kept locally",
    failed: "Save failed",
    conflict: "Conflict",
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-black/5">
      <span
        className={
          status === "failed" || status === "conflict"
            ? "text-rose-700"
            : status === "saved"
              ? "text-teal-700"
              : "text-slate-700"
        }
      >
        {label[status] ?? status}
      </span>
      {error ? <span className="text-rose-600">{error}</span> : null}
      {status === "failed" || status === "offline" ? (
        <button type="button" onClick={onRetry} className="underline">
          Retry
        </button>
      ) : null}
    </div>
  );
}

function RecoveryBanner({
  onAccept,
  onDiscard,
}: {
  onAccept: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
      Local draft recovered after a failed or interrupted save.
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="rounded-full bg-amber-800 px-3 py-1 text-xs font-extrabold text-white"
        >
          Restore draft
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-amber-900"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function validateModule(mod: TeachModuleDetail, level: TeachLevelDetail | null) {
  const notes: string[] = [];
  if (!mod.title.trim()) notes.push("Module needs a title");
  if (mod.sections.every((section) => section.levels.length === 0)) {
    notes.push("Add at least one lesson or game");
  }
  const hasLesson = mod.sections.some((section) =>
    section.levels.some((item) => item.kind === "lesson"),
  );
  const hasQuiz = mod.sections.some((section) =>
    section.levels.some((item) => item.kind === "game" && item.gameType === "quiz"),
  );
  if (!hasLesson) notes.push("Add a lesson for a complete first draft");
  if (!hasQuiz) notes.push("Add a quiz to check understanding");
  if (level?.kind === "lesson" && level.lesson) {
    const empty = !(level.lesson.blocks?.length || level.lesson.markdown.trim());
    if (empty) notes.push("Current lesson is empty");
  }
  if (mod.published) notes.push("Published — students stay on the frozen revision; drafts stay private");
  else notes.push("Draft — publish runs the quality checklist before students see this");
  if (notes.length === 0) notes.push("Looks ready to playtest");
  return notes;
}

/** @deprecated Prefer TeachModuleWorkspace */
export function TeachModuleEditor({ initial }: { initial: TeachModuleDetail }) {
  return <TeachModuleWorkspace initial={initial} />;
}
