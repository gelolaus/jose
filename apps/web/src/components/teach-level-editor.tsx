"use client";

import { GameEditor } from "@/components/teach-game-editor";
import { FieldLabel } from "@/components/teach-shell";
import { LessonBlocksEditor } from "@/components/lesson-blocks-editor";
import { fetchTeachLevel, fetchTeachModule, importTeachQuestions, patchTeachLevel, putTeachGame, putTeachLesson } from "@/lib/path-api";
import {
  describeLessonBlocksIssue,
  markdownToStarterBlocks,
  type GameContent,
  type LessonBlocks,
  type TeachLevelDetail,
  type TeachModuleDetail,
} from "@jose/shared";
import { useCallback, useEffect, useState } from "react";

export type LevelDraft = {
  id: string;
  title: string;
  blocks: LessonBlocks;
  game: GameContent | null;
};

export function TeachLevelEditor({
  moduleId,
  level,
  onLevelChange,
  onModuleChange,
  onDraftChange,
  onGuardChange,
}: {
  moduleId: string;
  level: TeachLevelDetail;
  onLevelChange: (level: TeachLevelDetail) => Promise<void>;
  onModuleChange: (mod: TeachModuleDetail) => void;
  onDraftChange: (draft: LevelDraft) => void;
  onGuardChange: (guard: { dirty: boolean; save: () => Promise<boolean> } | null) => void;
}) {
  const [title, setTitle] = useState(level.title);
  const [blocks, setBlocks] = useState<LessonBlocks>(
    level.lesson?.blocks ?? markdownToStarterBlocks(level.lesson?.markdown ?? ""),
  );
  const [game, setGame] = useState<GameContent | null>(level.game);
  const [revision, setRevision] = useState(level.revision);
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({
      title: level.title,
      blocks: level.lesson?.blocks ?? markdownToStarterBlocks(level.lesson?.markdown ?? ""),
      game: level.game,
    }),
  );

  const serialize = useCallback(
    () => JSON.stringify({ title, blocks, game }),
    [title, blocks, game],
  );

  const dirty = serialize() !== baseline;

  useEffect(() => {
    onDraftChange({ id: level.id, title, blocks, game });
  }, [blocks, game, level.id, onDraftChange, title]);

  useEffect(() => {
    setError(null);
    setConflict(null);
  }, [blocks, game, title]);

  const save = useCallback(async () => {
    setError(null);
    setConflict(null);
    if (level.kind === "lesson") {
      const issue = describeLessonBlocksIssue(blocks);
      if (issue) {
        setError(issue);
        setStatus("failed");
        return false;
      }
    }
    if (level.kind === "game" && !game) {
      setError("This game has no content yet.");
      setStatus("failed");
      return false;
    }
    setStatus("saving");
    let nextRevision = revision;
    try {
      if (title.trim() !== level.title) {
        const titled = await patchTeachLevel(level.id, {
          title: title.trim(),
          expectedRevision: nextRevision,
        });
        nextRevision = titled.revision;
        setRevision(titled.revision);
      }
      const saved =
        level.kind === "lesson"
          ? await putTeachLesson(level.id, {
              blocks,
              expectedRevision: nextRevision,
            })
          : await putTeachGame(level.id, {
              ...game!,
              expectedRevision: nextRevision,
            });
      setBaseline(JSON.stringify({
        title: saved.title,
        blocks: saved.lesson?.blocks ?? blocks,
        game: saved.game,
      }));
      setTitle(saved.title);
      if (saved.lesson?.blocks) setBlocks(saved.lesson.blocks);
      if (saved.game) setGame(saved.game);
      setRevision(saved.revision);
      setStatus("saved");
      await onLevelChange(saved);
      onModuleChange(await fetchTeachModule(moduleId));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save";
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "CONTENT_CONFLICT") {
        setConflict(message);
        setStatus("failed");
      } else {
        setError(message);
        setStatus("failed");
      }
      return false;
    }
  }, [
    blocks,
    game,
    level.id,
    level.kind,
    level.title,
    moduleId,
    onLevelChange,
    onModuleChange,
    revision,
    title,
  ]);

  useEffect(() => {
    onGuardChange({ dirty, save });
    return () => onGuardChange(null);
  }, [dirty, onGuardChange, save]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={status === "saving" || !dirty}
          onClick={() => void save()}
          className="jose-button disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <p className="text-sm font-bold text-[var(--jose-ink-muted)]">
          {status === "saved" && !dirty
            ? "Saved"
            : dirty
              ? "Unsaved"
              : "No changes"}
        </p>
      </div>
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </p>
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
        onChange={(e) => {
          setTitle(e.target.value);
          setStatus("dirty");
        }}
        className="w-full rounded-2xl bg-[var(--jose-paper)] px-4 py-3 font-bold ring-1 ring-[var(--jose-rule)]"
      />
      {level.kind === "lesson" ? (
        <LessonBlocksEditor
          moduleId={moduleId}
          blocks={blocks}
          onChange={(next) => {
            setBlocks(next);
            setStatus("dirty");
          }}
          disabled={status === "saving"}
        />
      ) : null}
      {level.kind === "game" && game ? (
        <>
          <GameEditor
            game={game}
            onChange={(next) => {
              setGame(next);
              setStatus("dirty");
            }}
          />
          {game.type === "quiz" && !dirty ? (
            <details className="rounded-2xl bg-[var(--jose-surface-control)] p-3">
              <summary className="cursor-pointer text-sm font-extrabold text-[var(--jose-ink)]">
                More tools
              </summary>
              <div className="mt-3">
                <QuestionImportPanel
                  levelId={level.id}
                  onImported={async (next) => {
                    await onLevelChange(next);
                    setGame(next.game);
                    setRevision(next.revision);
                    setBaseline(JSON.stringify({
                      title: next.title,
                      blocks,
                      game: next.game,
                    }));
                    setStatus("saved");
                  }}
                />
              </div>
            </details>
          ) : null}
        </>
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
    <div className="rounded-2xl bg-[var(--jose-paper)] p-4 ring-1 ring-[var(--jose-rule)]">
      <p className="text-sm font-extrabold text-[var(--jose-ink)]">Bulk question import</p>
      <p className="mt-1 text-xs font-semibold text-[var(--jose-ink-muted)]">
        Preview validates every row before commit. Save the game first if you have other edits.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as "csv" | "json")}
          className="rounded-xl bg-[var(--jose-paper)] px-3 py-2 text-sm font-bold"
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <select
          value={mode}
          onChange={(e) =>
            setMode(e.target.value as "all-or-nothing" | "partial")
          }
          className="rounded-xl bg-[var(--jose-paper)] px-3 py-2 text-sm font-bold"
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
        className="mt-3 w-full rounded-2xl bg-[var(--jose-surface-control)] px-3 py-2 font-mono text-xs ring-1 ring-[var(--jose-rule)]"
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
          className="jose-button jose-button--secondary min-h-11 px-4 py-2 text-xs"
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
          className="jose-button min-h-11 px-4 py-2 text-xs"
        >
          Commit import
        </button>
      </div>
      {preview ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-bold text-[var(--jose-ink)]">
            {preview.validCount}/{preview.totalRows} valid · {preview.errorCount} errors · mode{" "}
            {preview.mode}
          </p>
          {preview.errors.map((err) => (
            <p key={`${err.row}-${err.message}`} className="font-semibold text-[var(--jose-coral)]">
              Row {err.row}
              {err.field ? ` · ${err.field}` : ""}: {err.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
