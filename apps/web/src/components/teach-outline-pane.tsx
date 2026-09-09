"use client";

import { OverflowItem, OverflowMenu } from "@/components/teach-overflow-menu";
import { usePendingMap } from "@/lib/use-pending-map";
import {
  applyTeachTemplate,
  createTeachLevel,
  createTeachSection,
  deleteTeachLevel,
  duplicateTeachLevel,
  fetchTeachModule,
  moveTeachLevel,
} from "@/lib/path-api";
import type {
  GameType,
  ModuleTemplateId,
  TeachModuleDetail,
} from "@jose/shared";
import { useState } from "react";

const GAME_TYPES: { id: GameType; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "quiz", label: "Quiz" },
  { id: "memory", label: "Matching" },
  { id: "sort", label: "Sorting" },
  { id: "blank", label: "Fill in the Blank" },
];

const TEMPLATES: { id: ModuleTemplateId; label: string }[] = [
  { id: "lesson-retrieval", label: "Lesson + retrieval" },
  { id: "source-investigation", label: "Source investigation" },
  { id: "timeline", label: "Timeline" },
  { id: "chapter-checkpoint", label: "Chapter checkpoint" },
];

export type OutlineSelection =
  | { type: "module" }
  | { type: "section"; sectionId: string }
  | { type: "level"; levelId: string };

type PendingMap = ReturnType<typeof usePendingMap>;

export function TeachOutlinePane({
  mod,
  selection,
  draftTitle,
  opError,
  pending,
  onSelect,
  onSelectLevel,
  onModuleChange,
  setOpError,
}: {
  mod: TeachModuleDetail;
  selection: OutlineSelection;
  draftTitle?: string;
  opError: Record<string, string>;
  pending: PendingMap;
  onSelect: (selection: OutlineSelection) => void;
  onSelectLevel: (levelId: string) => void;
  onModuleChange: (mod: TeachModuleDetail) => void;
  setOpError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const [addKind, setAddKind] = useState<"lesson" | "game" | "section" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addGameType, setAddGameType] = useState<GameType>("quiz");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const activeSectionId =
    selection.type === "section"
      ? selection.sectionId
      : selection.type === "level"
        ? mod.sections.find((s) => s.levels.some((l) => l.id === selection.levelId))?.id
        : mod.sections[0]?.id;

  async function runOp(key: string, work: () => Promise<TeachModuleDetail>) {
    const result = await pending.run(key, work);
    if (result.ok) {
      onModuleChange(result.data);
      setOpError((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return true;
    }
    setOpError((prev) => ({ ...prev, [key]: result.error }));
    return false;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onSelect({ type: "module" })}
        className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm font-extrabold ${
          selection.type === "module"
            ? "jose-nav-active-teach"
            : "text-[var(--jose-ink)] hover:bg-[var(--jose-surface-control)]"
        }`}
      >
        Module details
      </button>

      {mod.sections.map((section) => (
        <div key={section.id} className="space-y-1">
          <button
            type="button"
            onClick={() => onSelect({ type: "section", sectionId: section.id })}
            className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-extrabold ${
              selection.type === "section" && selection.sectionId === section.id
                ? "jose-nav-active-teach"
                : "text-[var(--jose-ink)] hover:bg-[var(--jose-surface-control)]"
            }`}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: section.themeColor }}
            />
            {section.title}
          </button>
          <ul className="space-y-1 pl-2">
            {section.levels.map((level, index) => {
              const selected =
                selection.type === "level" && selection.levelId === level.id;
              const title =
                selected && draftTitle && draftTitle.trim()
                  ? draftTitle
                  : level.title;
              return (
                <li
                  key={level.id}
                  draggable
                  onDragStart={() => setDraggingId(level.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    if (!draggingId || draggingId === level.id) return;
                    const key = `move-${draggingId}`;
                    await runOp(key, () =>
                      moveTeachLevel(draggingId, {
                        targetSectionId: section.id,
                        index,
                      }),
                    );
                    setDraggingId(null);
                  }}
                  className={`flex items-stretch gap-1 rounded-xl ${
                    draggingId === level.id ? "opacity-60" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectLevel(level.id)}
                    className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-left text-sm font-bold ${
                      selected
                        ? "jose-nav-active-teach"
                        : "text-[var(--jose-ink-muted)] hover:bg-[var(--jose-surface-control)]"
                    }`}
                  >
                    {title}
                    <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-wide opacity-70">
                      {level.kind}
                      {level.gameType ? ` · ${level.gameType}` : ""}
                    </span>
                  </button>
                  <OverflowMenu label={`Actions for ${level.title}`}>
                    <OverflowItem
                      disabled={index === 0}
                      onClick={() => {
                        void runOp(`move-up-${level.id}`, () =>
                          moveTeachLevel(level.id, "up"),
                        );
                      }}
                    >
                      Move up
                    </OverflowItem>
                    <OverflowItem
                      disabled={index === section.levels.length - 1}
                      onClick={() => {
                        void runOp(`move-down-${level.id}`, () =>
                          moveTeachLevel(level.id, "down"),
                        );
                      }}
                    >
                      Move down
                    </OverflowItem>
                    <OverflowItem
                      onClick={() => {
                        void (async () => {
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
                        })();
                      }}
                    >
                      Duplicate
                    </OverflowItem>
                    <OverflowItem
                      danger
                      onClick={() => {
                        if (!window.confirm(`Delete “${level.title}”?`)) return;
                        void (async () => {
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
                        })();
                      }}
                    >
                      Delete
                    </OverflowItem>
                  </OverflowMenu>
                </li>
              );
            })}
            <li
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                if (!draggingId) return;
                await runOp(`move-${draggingId}`, () =>
                  moveTeachLevel(draggingId, {
                    targetSectionId: section.id,
                    index: section.levels.length,
                  }),
                );
                setDraggingId(null);
              }}
            />
          </ul>
          {opError[`move-up-${section.levels[0]?.id}`] ||
          Object.keys(opError).some((key) => key.startsWith("move-") || key.startsWith("del-") || key.startsWith("dup-"))
            ? Object.entries(opError)
                .filter(([key]) =>
                  section.levels.some((level) => key.includes(level.id)),
                )
                .map(([key, message]) => (
                  <p key={key} className="px-2 text-xs font-bold text-[var(--jose-coral)]">
                    {message}
                  </p>
                ))
            : null}
        </div>
      ))}

      <div className="rounded-2xl bg-[var(--jose-surface-control)] p-2">
        {addKind ? (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const title = addTitle.trim();
              if (!title) return;
              if (addKind === "section") {
                const ok = await runOp("add-section", () =>
                  createTeachSection(mod.id, {
                    title,
                    subtitle: "Deep dive",
                    themeColor: mod.coverColor,
                  }),
                );
                if (ok) {
                  setAddTitle("");
                  setAddKind(null);
                }
                return;
              }
              if (!activeSectionId) return;
              const key = `add-level-${activeSectionId}`;
              const result = await pending.run(key, () =>
                createTeachLevel(activeSectionId, {
                  title,
                  kind: addKind,
                  gameType: addKind === "game" ? addGameType : undefined,
                }),
              );
              if (result.ok) {
                setAddTitle("");
                setAddKind(null);
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
            <p className="px-1 text-xs font-extrabold uppercase tracking-wide text-[var(--jose-ink-muted)]">
              Add {addKind === "game" ? "game" : addKind}
            </p>
            <input
              required
              autoFocus
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-xl bg-[var(--jose-paper)] px-3 py-2 text-sm font-bold ring-1 ring-[var(--jose-rule)]"
            />
            {addKind === "game" ? (
              <select
                value={addGameType}
                onChange={(e) => setAddGameType(e.target.value as GameType)}
                className="w-full rounded-xl bg-[var(--jose-paper)] px-3 py-2 text-sm font-bold"
              >
                {GAME_TYPES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex gap-2">
              <button type="submit" className="jose-button min-h-11 px-4 py-2 text-sm">
                Add
              </button>
              <button
                type="button"
                className="jose-button jose-button--secondary min-h-11 px-4 py-2 text-sm"
                onClick={() => {
                  setAddKind(null);
                  setAddTitle("");
                }}
              >
                Cancel
              </button>
            </div>
            {addKind !== "section" && activeSectionId && opError[`add-level-${activeSectionId}`] ? (
              <p className="text-xs font-bold text-[var(--jose-coral)]">
                {opError[`add-level-${activeSectionId}`]}
              </p>
            ) : null}
            {addKind === "section" && opError["add-section"] ? (
              <p className="text-xs font-bold text-[var(--jose-coral)]">{opError["add-section"]}</p>
            ) : null}
          </form>
        ) : (
          <div className="relative">
            <button
              type="button"
              className="jose-button flex min-h-11 w-full items-center justify-center px-4 py-2 text-sm"
              onClick={() => setPickerOpen((open) => !open)}
            >
              Add
            </button>
            {pickerOpen ? (
              <div className="absolute left-0 right-0 z-20 mt-1 rounded-2xl bg-[var(--jose-paper)] p-1 shadow-lg ring-1 ring-[var(--jose-rule)]">
                {(["lesson", "game", "section"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-extrabold capitalize text-[var(--jose-ink)]"
                    onClick={() => {
                      setAddKind(kind);
                      setPickerOpen(false);
                    }}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <details className="rounded-2xl px-1 py-1">
        <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wide text-[var(--jose-ink-muted)]">
          Starter structures
        </summary>
        <div className="mt-2 space-y-1">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              disabled={pending.isPending(`template-${template.id}`)}
              onClick={() => {
                void runOp(`template-${template.id}`, () =>
                  applyTeachTemplate(mod.id, {
                    templateId: template.id,
                    replaceEmptyStarter: false,
                  }),
                );
              }}
              className="w-full rounded-xl bg-[var(--jose-surface-control)] px-3 py-2 text-left text-xs font-bold text-[var(--jose-ink)] disabled:opacity-50"
            >
              Add {template.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
